package com.domesticconnects.payroll.service;

import com.domesticconnects.payroll.entity.SalaryRecord;
import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.lowagie.text.pdf.draw.LineSeparator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Month;
import java.time.format.TextStyle;
import java.util.Locale;

/**
 * Renders a salary slip PDF using OpenPDF (the {@code com.lowagie.text} API).
 * <p>
 * Layout: a simple letterhead header (company name / address / contact), a
 * horizontal rule, a centred "SALARY SLIP" title with the period, and a two
 * column details table (worker name, worker id, month/year, days present,
 * half days, paid days, wage per day, gross salary). Half days count at 0.5
 * paid days each, and the gross salary row is highlighted.
 * <p>
 * The letterhead details come from {@code payroll.company-*} configuration
 * (config-server), with sensible defaults for local development.
 */
@Component
public class SalarySlipPdfGenerator {

    private static final Color HEADER_COLOR = new Color(0, 62, 128);
    private static final Color GRAY = new Color(90, 90, 90);
    private static final Color LABEL_BG = new Color(244, 246, 248);
    private static final Color GROSS_BG = new Color(222, 235, 247);
    private static final Color RULE_COLOR = new Color(200, 205, 210);

    private final String companyName;
    private final String companyAddress;
    private final String companyContact;

    public SalarySlipPdfGenerator(
            @Value("${payroll.company-name:Domestic Connects}") String companyName,
            @Value("${payroll.company-address:Household Staffing & Domestic Help Services, Hyderabad, India}") String companyAddress,
            @Value("${payroll.company-contact:contact@domesticconnects.com}") String companyContact) {
        this.companyName = companyName;
        this.companyAddress = companyAddress;
        this.companyContact = companyContact;
    }

    /**
     * Generates the salary slip PDF bytes for the given (already calculated)
     * salary record.
     *
     * @param record the persisted salary data to render
     * @return the PDF document as a byte array
     */
    public byte[] generate(SalaryRecord record) {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4, 36, 36, 54, 36);

        try {
            PdfWriter.getInstance(document, output);
            document.addTitle("Salary Slip");
            document.addAuthor(companyName);
            document.addCreator(companyName);
            document.addSubject("Monthly salary slip for worker " + record.getWorkerName());
            document.open();

            addLetterhead(document);
            document.add(new LineSeparator(1f, 100f, RULE_COLOR, Element.ALIGN_CENTER, -2));

            addTitle(document, record);
            document.add(new LineSeparator(0.5f, 100f, RULE_COLOR, Element.ALIGN_CENTER, -2));

            document.add(detailsTable(record));

            document.add(new Paragraph(new Chunk(" ", new Font(Font.HELVETICA, 10))));
            document.add(new Paragraph("This is a computer-generated salary slip and does not require a signature.",
                    new Font(Font.HELVETICA, 8, Font.NORMAL, GRAY)));

            document.close();
        } catch (DocumentException e) {
            throw new IllegalStateException("Failed to generate salary slip PDF", e);
        } finally {
            // Close the document even when rendering failed mid-way.
            if (document.isOpen()) {
                document.close();
            }
        }

        return output.toByteArray();
    }

    /**
     * Simple letterhead: company name in bold, address and contact underneath.
     */
    private void addLetterhead(Document document) throws DocumentException {
        Paragraph name = new Paragraph(companyName,
                new Font(Font.HELVETICA, 22, Font.BOLD, HEADER_COLOR));
        name.setSpacingAfter(2);
        document.add(name);

        document.add(new Paragraph(companyAddress,
                new Font(Font.HELVETICA, 9, Font.NORMAL, GRAY)));
        document.add(new Paragraph(companyContact,
                new Font(Font.HELVETICA, 8, Font.NORMAL, GRAY)));
        document.add(new Chunk("\n"));
    }

    /**
     * Centred title and pay period.
     */
    private void addTitle(Document document, SalaryRecord record) throws DocumentException {
        Paragraph title = new Paragraph("SALARY SLIP",
                new Font(Font.HELVETICA, 16, Font.BOLD, HEADER_COLOR));
        title.setAlignment(Element.ALIGN_CENTER);
        title.setSpacingBefore(14);
        title.setSpacingAfter(4);
        document.add(title);

        Paragraph period = new Paragraph("For the month of " + monthYear(record),
                new Font(Font.HELVETICA, 11, Font.NORMAL, GRAY));
        period.setAlignment(Element.ALIGN_CENTER);
        period.setSpacingAfter(12);
        document.add(period);
    }

    /**
     * Two-column details table: label | value.
     */
    private PdfPTable detailsTable(SalaryRecord record) throws DocumentException {
        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{0.4f, 0.6f});
        table.setSpacingBefore(12);

        addRow(table, "Worker Name", record.getWorkerName(), false);
        addRow(table, "Worker ID", String.valueOf(record.getWorkerId()), false);
        addRow(table, "Month / Year", monthYear(record), false);
        addRow(table, "Days Present", String.valueOf(record.getPresentDays()), false);
        addRow(table, "Half Days", String.valueOf(halfDays(record)), false);
        addRow(table, "Paid Days", formatDays(paidDays(record)), false);
        addRow(table, "Wage Per Day", formatMoney(record.getWagePerDay()), false);
        addRow(table, "Gross Salary", formatMoney(record.getGrossSalary()), true);

        return table;
    }

    private void addRow(PdfPTable table, String label, String value, boolean highlight) {
        Font labelFont = new Font(Font.HELVETICA, 10, Font.BOLD, new Color(60, 60, 60));
        Font valueFont = new Font(Font.HELVETICA, 10,
                highlight ? Font.BOLD : Font.NORMAL, Color.BLACK);

        PdfPCell labelCell = new PdfPCell(new Phrase(label, labelFont));
        labelCell.setPadding(6);
        labelCell.setBorderColor(RULE_COLOR);
        labelCell.setBackgroundColor(highlight ? GROSS_BG : LABEL_BG);

        PdfPCell valueCell = new PdfPCell(new Phrase(value, valueFont));
        valueCell.setPadding(6);
        valueCell.setBorderColor(RULE_COLOR);
        valueCell.setBackgroundColor(highlight ? GROSS_BG : Color.WHITE);

        table.addCell(labelCell);
        table.addCell(valueCell);
    }

    /**
     * Half-day attendances, treating a missing (legacy) value as none.
     */
    private int halfDays(SalaryRecord record) {
        return record.getHalfDays() == null ? 0 : record.getHalfDays();
    }

    /**
     * Paid days = full present days + half days counted at 0.5 each.
     */
    private BigDecimal paidDays(SalaryRecord record) {
        return BigDecimal.valueOf(record.getPresentDays())
                .add(BigDecimal.valueOf(halfDays(record)).divide(BigDecimal.valueOf(2)));
    }

    /**
     * Formats a day count with up to two decimals, e.g. {@code 25} or
     * {@code 25.5}.
     */
    private String formatDays(BigDecimal days) {
        NumberFormat format = NumberFormat.getNumberInstance(Locale.US);
        format.setMinimumFractionDigits(0);
        format.setMaximumFractionDigits(2);
        return format.format(days);
    }

    /**
     * e.g. {@code June 2026}.
     */
    private String monthYear(SalaryRecord record) {
        return Month.of(record.getMonth()).getDisplayName(TextStyle.FULL, Locale.ENGLISH)
                + " " + record.getYear();
    }

    /**
     * Formats an amount with thousands separators and two decimals, e.g.
     * {@code Rs. 12,000.00}. The plain "Rs." prefix (instead of the Unicode
     * rupee symbol) guarantees correct rendering with the standard PDF fonts.
     */
    private String formatMoney(BigDecimal amount) {
        NumberFormat format = NumberFormat.getNumberInstance(Locale.US);
        format.setMinimumFractionDigits(2);
        format.setMaximumFractionDigits(2);
        return "Rs. " + format.format(amount);
    }
}
