import Foundation

/// Date formatting utilities
enum DateFormatterProvider {
    
    // MARK: - Formatters
    
    private static let monthYearFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM yyyy"
        return formatter
    }()
    
    private static let shortMonthFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM"
        return formatter
    }()
    
    private static let yearMonthParser: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM"
        return formatter
    }()
    
    private static let fullDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()
    
    // MARK: - Formatting Methods
    
    /// Formats a date as "Jan 2024"
    static func monthYear(_ date: Date) -> String {
        monthYearFormatter.string(from: date)
    }
    
    /// Formats a date as "Jan"
    static func shortMonth(_ date: Date) -> String {
        shortMonthFormatter.string(from: date)
    }
    
    /// Formats a date as "Jan 15, 2024"
    static func fullDate(_ date: Date) -> String {
        fullDateFormatter.string(from: date)
    }
    
    /// Parses a "yyyy-MM" string into a Date
    static func parseYearMonth(_ string: String) -> Date? {
        yearMonthParser.date(from: string)
    }
    
    /// Formats a "yyyy-MM" string as "Jan 2024"
    static func formatYearMonth(_ string: String) -> String {
        guard let date = parseYearMonth(string) else { return string }
        return monthYear(date)
    }

    /// Formats a date as "yyyy-MM"
    static func yearMonth(_ date: Date) -> String {
        yearMonthParser.string(from: date)
    }
}
