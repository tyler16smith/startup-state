import {
	endOfMonth,
	format,
	getDate,
	getDaysInMonth,
	startOfMonth,
} from "date-fns";

export interface ReportingMonth {
	effectiveNow: Date;
	monthStartDate: Date;
	monthEndDate: Date;
	startDate: string;
	endDate: string;
	dayOfMonth: number;
	daysInMonth: number;
}

export function getReportingMonth(now: Date = new Date()): ReportingMonth {
	const effectiveNow = now;
	const monthStartDate = startOfMonth(effectiveNow);
	const monthEndDate = endOfMonth(effectiveNow);

	return {
		effectiveNow,
		monthStartDate,
		monthEndDate,
		startDate: format(monthStartDate, "yyyy-MM-dd"),
		endDate: format(monthEndDate, "yyyy-MM-dd"),
		dayOfMonth: getDate(effectiveNow),
		daysInMonth: getDaysInMonth(effectiveNow),
	};
}
