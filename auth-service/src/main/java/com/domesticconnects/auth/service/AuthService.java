package com.domesticconnects.auth.service;

import com.domesticconnects.auth.dto.*;
import com.domesticconnects.auth.entity.Role;
import com.domesticconnects.auth.entity.User;
import com.domesticconnects.auth.exception.ResourceNotFoundException;
import com.domesticconnects.auth.exception.TokenRefreshException;
import com.domesticconnects.auth.exception.UserAlreadyExistsException;
import com.domesticconnects.auth.repository.UserRepository;
import com.domesticconnects.auth.security.JwtUtils;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtils jwtUtils;
    private final VerificationMailer verificationMailer;

    @Value("${jwt.access-token-expiration}")
    private long accessTokenExpiration;

    /**
     * Registers a new user account.
     */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new UserAlreadyExistsException(
                    "User with email '" + request.getEmail() + "' already exists");
        }

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .isVerified(false)
                .isActive(true)
                .verificationToken(UUID.randomUUID().toString())
                .build();

        user = userRepository.save(user);

        // Best-effort: sends the verification link (or logs it when no mailer
        // is configured). Never fails registration.
        verificationMailer.sendVerificationEmail(user.getEmail(), user.getVerificationToken());

        log.info("User registered successfully: {} with role {}", user.getEmail(), user.getRole());

        // Generate tokens
        String accessToken = jwtUtils.generateAccessToken(
                user.getEmail(), user.getId(), user.getRole());
        String refreshToken = jwtUtils.generateRefreshToken(user.getEmail());

        return buildAuthResponse(user, accessToken, refreshToken);
    }

    /**
     * Authenticates a user and returns JWT tokens.
     */
    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new UsernameNotFoundException(
                        "User not found with email: " + request.getEmail()));

        if (!user.isActive()) {
            throw new IllegalArgumentException("Account is deactivated. Contact an administrator.");
        }

        if (!user.isVerified()) {
            throw new IllegalArgumentException(
                    "Please verify your email before logging in. Check your inbox for the verification link.");
        }

        String accessToken = jwtUtils.generateAccessToken(
                user.getEmail(), user.getId(), user.getRole());
        String refreshToken = jwtUtils.generateRefreshToken(user.getEmail());

        log.info("User logged in successfully: {}", user.getEmail());

        return buildAuthResponse(user, accessToken, refreshToken);
    }

    /**
     * Issues a new access token using a valid refresh token.
     */
    public AuthResponse refresh(RefreshTokenRequest request) {
        String refreshToken = request.getRefreshToken();

        // Validate the refresh token
        if (!jwtUtils.validateToken(refreshToken)) {
            throw new TokenRefreshException("Invalid or expired refresh token");
        }

        // Ensure it's actually a refresh token
        String tokenType = jwtUtils.getTokenType(refreshToken);
        if (!"refresh".equals(tokenType)) {
            throw new TokenRefreshException("Provided token is not a refresh token");
        }

        String email = jwtUtils.getEmailFromToken(refreshToken);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new TokenRefreshException(
                        "User not found for refresh token"));

        if (!user.isActive()) {
            throw new TokenRefreshException("Account is deactivated");
        }

        String newAccessToken = jwtUtils.generateAccessToken(
                user.getEmail(), user.getId(), user.getRole());
        String newRefreshToken = jwtUtils.generateRefreshToken(user.getEmail());

        log.info("Token refreshed for user: {}", user.getEmail());

        return buildAuthResponse(user, newAccessToken, newRefreshToken);
    }

    /**
     * Verifies a user's email using the verification token.
     */
    @Transactional
    public ApiResponse<Void> verifyEmail(String token) {
        User user = userRepository.findByVerificationToken(token)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Verification token", "token", token));

        if (user.isVerified()) {
            return ApiResponse.success("Email is already verified", null);
        }

        user.setVerified(true);
        user.setVerificationToken(null);
        userRepository.save(user);

        log.info("Email verified for user: {}", user.getEmail());

        return ApiResponse.success("Email verified successfully", null);
    }

    /**
     * Lists all registered users (admin function). Consumed by admin-service
     * for the dashboard user counts and users-by-role analytics.
     */
    public ApiResponse<List<AuthResponse.UserInfo>> getAllUsers() {
        List<AuthResponse.UserInfo> users = userRepository.findAll().stream()
                .map(user -> AuthResponse.UserInfo.builder()
                        .id(user.getId())
                        .name(user.getName())
                        .email(user.getEmail())
                        .role(user.getRole())
                        .isVerified(user.isVerified())
                        .isActive(user.isActive())
                        .build())
                .toList();

        return ApiResponse.success("Users fetched successfully", users);
    }

    /**
     * Lists verified, active WORKER accounts — the pool an employer can
     * assign to a job post. EMPLOYER/ADMIN only (enforced in the controller
     * against the gateway-forwarded {@code X-User-Role} header).
     */
    public ApiResponse<List<AuthResponse.UserInfo>> getWorkers() {
        List<AuthResponse.UserInfo> workers = userRepository.findByRole(Role.WORKER).stream()
                .filter(User::isVerified)
                .filter(User::isActive)
                .map(user -> AuthResponse.UserInfo.builder()
                        .id(user.getId())
                        .name(user.getName())
                        .email(user.getEmail())
                        .role(user.getRole())
                        .isVerified(user.isVerified())
                        .isActive(user.isActive())
                        .build())
                .toList();

        return ApiResponse.success("Workers fetched successfully", workers);
    }

    /**
     * Activates a user account (admin function).
     */
    @Transactional
    public ApiResponse<Void> activateUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        if (user.isActive()) {
            return ApiResponse.success("Account is already active", null);
        }

        user.setActive(true);
        userRepository.save(user);

        log.info("User account activated: {}", user.getEmail());

        return ApiResponse.success("Account activated successfully", null);
    }

    /**
     * Deactivates a user account (admin function).
     */
    @Transactional
    public ApiResponse<Void> deactivateUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        if (!user.isActive()) {
            return ApiResponse.success("Account is already deactivated", null);
        }

        user.setActive(false);
        userRepository.save(user);

        log.info("User account deactivated: {}", user.getEmail());

        return ApiResponse.success("Account deactivated successfully", null);
    }

    /**
     * Builds a standardized AuthResponse from a User entity and tokens.
     */
    private AuthResponse buildAuthResponse(User user, String accessToken, String refreshToken) {
        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(accessTokenExpiration)
                .user(AuthResponse.UserInfo.builder()
                        .id(user.getId())
                        .name(user.getName())
                        .email(user.getEmail())
                        .role(user.getRole())
                        .isVerified(user.isVerified())
                        .isActive(user.isActive())
                        .build())
                .build();
    }
}
