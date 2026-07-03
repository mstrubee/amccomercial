import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from "date-fns";
import { safeFormatDate } from "@/lib/date-utils";
import { es } from "date-fns/locale";
import type { CalendarEvent } from "@/hooks/useGoogleCalendar";

interface Props {
  currentMonth: Date;
  events: CalendarEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export default function CalendarGrid({ currentMonth, events, onDayClick, onEventClick }: Props) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  const getEventsForDay = (day: Date) => {
    return events.filter((ev) => {
      const evDate = ev.start.dateTime || ev.start.date;
      if (!evDate) return false;
      return isSameDay(new Date(evDate), day);
    });
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 bg-muted/50">
        {dayNames.map((name) => (
          <div key={name} className="text-center text-xs font-semibold text-muted-foreground py-2 border-b border-border">
            {name}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);
          const dayEvents = getEventsForDay(day);

          return (
            <div
              key={idx}
              onClick={() => onDayClick(day)}
              className={cn(
                "min-h-[100px] border-b border-r border-border p-1.5 cursor-pointer transition-colors hover:bg-accent/30",
                !inMonth && "bg-muted/20 text-muted-foreground/50"
              )}
            >
              <div className={cn(
                "text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                today && "bg-primary text-primary-foreground"
              )}>
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => {
                  const time = safeFormatDate(ev.start.dateTime, "HH:mm", undefined, "");
                  return (
                    <button
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev);
                      }}
                      className="w-full text-left px-1.5 py-0.5 rounded text-[10px] leading-tight bg-primary/15 text-primary hover:bg-primary/25 truncate block transition-colors"
                    >
                      {time && <span className="font-semibold mr-0.5">{time}</span>}
                      {ev.summary}
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} más</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
