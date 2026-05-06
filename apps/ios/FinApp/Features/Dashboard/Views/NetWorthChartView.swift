import SwiftUI
import Charts

/// A line chart displaying net worth over time
struct NetWorthChartView: View {
    
    let dataPoints: [NetWorthPoint]
    
    private var minValue: Double {
        let min = dataPoints.map(\.total).min() ?? 0
        return max(0, min * 0.9) // 10% padding below, but never negative
    }
    
    private var maxValue: Double {
        let max = dataPoints.map(\.total).max() ?? 0
        return max * 1.1 // 10% padding above
    }
    
    var body: some View {
        Chart(dataPoints) { point in
            LineMark(
                x: .value("Month", point.date),
                y: .value("Net Worth", point.total)
            )
            .foregroundStyle(
                LinearGradient(
                    colors: [.blue, .cyan],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
            .interpolationMethod(.catmullRom)
            
            AreaMark(
                x: .value("Month", point.date),
                y: .value("Net Worth", point.total)
            )
            .foregroundStyle(
                LinearGradient(
                    colors: [.blue.opacity(0.3), .cyan.opacity(0.1), .clear],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .interpolationMethod(.catmullRom)
        }
        .chartXAxis {
            AxisMarks(values: .stride(by: .month, count: 3)) { value in
                if let date = value.as(Date.self) {
                    AxisValueLabel {
                        Text(DateFormatterProvider.shortMonth(date))
                            .font(.caption2)
                    }
                }
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                    .foregroundStyle(Color.secondary.opacity(0.3))
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading) { value in
                if let amount = value.as(Double.self) {
                    AxisValueLabel {
                        Text(CurrencyFormatter.formatShort(amount))
                            .font(.caption2)
                    }
                }
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                    .foregroundStyle(Color.secondary.opacity(0.3))
            }
        }
        .chartYScale(domain: minValue...maxValue)
        .frame(height: 200)
    }
}

// MARK: - Preview

#Preview {
    let sampleData = [
        NetWorthPoint(month: "2024-01", total: 100000),
        NetWorthPoint(month: "2024-02", total: 105000),
        NetWorthPoint(month: "2024-03", total: 102000),
        NetWorthPoint(month: "2024-04", total: 110000),
        NetWorthPoint(month: "2024-05", total: 115000),
        NetWorthPoint(month: "2024-06", total: 120000),
        NetWorthPoint(month: "2024-07", total: 118000),
        NetWorthPoint(month: "2024-08", total: 125000),
        NetWorthPoint(month: "2024-09", total: 130000),
        NetWorthPoint(month: "2024-10", total: 128000),
        NetWorthPoint(month: "2024-11", total: 135000),
        NetWorthPoint(month: "2024-12", total: 140000),
    ]
    
    return FinCard {
        VStack(alignment: .leading, spacing: 12) {
            Text("Net Worth")
                .font(.headline)
            
            NetWorthChartView(dataPoints: sampleData)
        }
    }
    .padding()
}

// MARK: - Monthly Net Gains Chart

/// Bar chart showing monthly income vs expenses with a net-gain overlay.
struct MonthlyNetGainsChartView: View {
    let months: [MonthlyAggregate]

    var body: some View {
        Chart {
            ForEach(months) { month in
                BarMark(
                    x: .value("Month", month.date, unit: .month),
                    y: .value("Net", month.netGain)
                )
                .foregroundStyle(month.netGain >= 0 ? Color.green.opacity(0.85) : Color.red.opacity(0.85))
                .cornerRadius(4)
            }
        }
        .chartXAxis {
            AxisMarks(values: .stride(by: .month, count: 2)) { value in
                if let date = value.as(Date.self) {
                    AxisValueLabel {
                        Text(DateFormatterProvider.shortMonth(date))
                            .font(.caption2)
                    }
                }
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                    .foregroundStyle(Color.secondary.opacity(0.3))
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading) { value in
                if let amount = value.as(Double.self) {
                    AxisValueLabel {
                        Text(CurrencyFormatter.formatShort(amount))
                            .font(.caption2)
                    }
                }
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                    .foregroundStyle(Color.secondary.opacity(0.3))
            }
        }
        .frame(height: 180)
    }
}

struct ForecastedBalanceChartView: View {
    let points: [ForecastedBalancePoint]

    private var minValue: Double {
        let minimum = points.map(\.value).min() ?? 0
        return max(0, minimum * 0.9)
    }

    private var maxValue: Double {
        max((points.map(\.value).max() ?? 0) * 1.1, 1)
    }

    var body: some View {
        Chart(points) { point in
            LineMark(
                x: .value("Month", point.date),
                y: .value("Balance", point.value)
            )
            .foregroundStyle(point.isForecast ? Color.green : Color.blue)
            .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round, dash: point.isForecast ? [6, 5] : []))
            .interpolationMethod(.catmullRom)
        }
        .chartXAxis {
            AxisMarks(values: .stride(by: .month, count: 3)) { value in
                if let date = value.as(Date.self) {
                    AxisValueLabel {
                        Text(DateFormatterProvider.shortMonth(date))
                            .font(.caption2)
                    }
                }
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                    .foregroundStyle(Color.secondary.opacity(0.3))
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading) { value in
                if let amount = value.as(Double.self) {
                    AxisValueLabel {
                        Text(CurrencyFormatter.formatShort(amount))
                            .font(.caption2)
                    }
                }
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                    .foregroundStyle(Color.secondary.opacity(0.3))
            }
        }
        .chartYScale(domain: minValue...maxValue)
        .frame(height: 200)
    }
}
