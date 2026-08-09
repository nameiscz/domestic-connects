package com.domesticconnects.auth.repository;

import com.domesticconnects.auth.entity.Role;
import com.domesticconnects.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByVerificationToken(String verificationToken);

    boolean existsByEmail(String email);

    List<User> findByRole(Role role);
}
