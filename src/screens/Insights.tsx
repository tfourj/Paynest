import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { EmptyState, Metric } from "../components/common";
import { styles } from "../styles";
import type { Colors } from "../theme";
import type { Subscription } from "../types";
import { colorFor } from "../utils/category";
import { formatMoney, monthlyCost } from "../utils/subscriptions";

type InsightsProps = {
  c: Colors;
  subscriptions: Subscription[];
  monthly: number;
  currency: string;
};

export function Insights({ c, subscriptions, monthly, currency }: InsightsProps) {
  const [viewedMonth, setViewedMonth] = useState(() => startOfMonth(new Date()));
  const max = Math.max(1, ...subscriptions.map(monthlyCost));
  const calendarDays = buildRenewalCalendar(subscriptions, viewedMonth);
  const calendarWeeks = chunkCalendarWeeks(calendarDays);
  const monthLabel = viewedMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  function changeViewedMonth(offset: number) {
    setViewedMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <Text style={[styles.greeting, { color: c.textMuted }]}>Your spending patterns</Text>
      <Text style={[styles.title, { color: c.text }]}>Insights</Text>
      <View style={styles.metricGrid}>
        <Metric c={c} label="Monthly" value={formatMoney(monthly, currency)} />
        <Metric c={c} label="Yearly" value={formatMoney(monthly * 12, currency)} />
      </View>

      {subscriptions.length === 0 ? (
        <EmptyState c={c} />
      ) : (
        <>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Monthly breakdown</Text>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            {subscriptions.map((item) => (
              <View key={item.id} style={styles.barRow}>
                <View style={styles.barTitle}>
                  <Text style={[styles.barName, { color: c.text }]}>{item.name}</Text>
                  <Text style={[styles.barPrice, { color: c.textMuted }]}>
                    {formatMoney(monthlyCost(item), item.currency)}
                  </Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: c.surfaceMuted }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: colorFor(item.category),
                        width: `${Math.max((monthlyCost(item) / max) * 100, 8)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: c.text }]}>Renewal calendar</Text>
          <View
            style={[
              styles.card,
              styles.calendarCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <View style={styles.calendarHeader}>
              <Pressable
                accessibilityLabel="Previous month"
                onPress={() => changeViewedMonth(-1)}
                style={[styles.calendarArrowButton, { backgroundColor: c.surfaceMuted }]}
              >
                <Ionicons name="chevron-back" size={18} color={c.text} />
              </Pressable>
              <Text style={[styles.calendarMonth, { color: c.text }]}>{monthLabel}</Text>
              <Pressable
                accessibilityLabel="Next month"
                onPress={() => changeViewedMonth(1)}
                style={[styles.calendarArrowButton, { backgroundColor: c.surfaceMuted }]}
              >
                <Ionicons name="chevron-forward" size={18} color={c.text} />
              </Pressable>
            </View>
            <View style={styles.calendarWeekHeader}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <Text key={day} style={[styles.calendarWeekday, { color: c.textMuted }]}>
                  {day}
                </Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarWeeks.map((week, weekIndex) => (
                <View key={`week-${weekIndex}`} style={styles.calendarWeek}>
                  {week.map((day, dayIndex) => (
                    <View
                      key={day.dateKey ?? `empty-${weekIndex}-${dayIndex}`}
                      style={[
                        styles.calendarDay,
                        {
                          backgroundColor: day.dateKey ? c.surfaceMuted : "transparent",
                          borderColor: day.isToday ? c.primary : c.border,
                        },
                      ]}
                    >
                      {day.dateKey ? (
                        <>
                          <Text style={[styles.calendarDayNumber, { color: c.text }]}>
                            {day.dayOfMonth}
                          </Text>
                          <View style={styles.calendarRenewalStack}>
                            {day.subscriptions.slice(0, 2).map((item) => (
                              <View
                                key={item.id}
                                style={[
                                  styles.calendarRenewalPill,
                                  { backgroundColor: colorFor(item.category) },
                                ]}
                              >
                                <Text numberOfLines={1} style={styles.calendarRenewalText}>
                                  {item.name}
                                </Text>
                              </View>
                            ))}
                            {day.subscriptions.length > 2 ? (
                              <Text style={[styles.calendarMoreText, { color: c.textMuted }]}>
                                +{day.subscriptions.length - 2}
                              </Text>
                            ) : null}
                          </View>
                        </>
                      ) : null}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

type CalendarDay = {
  dateKey?: string;
  dayOfMonth?: number;
  isToday?: boolean;
  subscriptions: Subscription[];
};

function buildRenewalCalendar(subscriptions: Subscription[], viewedMonth: Date): CalendarDay[] {
  const today = new Date();
  const year = viewedMonth.getFullYear();
  const month = viewedMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingEmptyDays = (firstDay.getDay() + 6) % 7;
  const renewalsByDate = new Map<string, Subscription[]>();

  subscriptions.forEach((item) => {
    const renewal = new Date(`${item.nextRenewalDate}T00:00:00`);
    if (renewal.getFullYear() !== year || renewal.getMonth() !== month) return;

    const dateKey = formatDateKey(renewal);
    const existing = renewalsByDate.get(dateKey) ?? [];
    renewalsByDate.set(dateKey, [...existing, item]);
  });

  const days: CalendarDay[] = Array.from(
    { length: leadingEmptyDays },
    () => ({ subscriptions: [] }),
  );
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = formatDateKey(date);

    days.push({
      dateKey,
      dayOfMonth: day,
      isToday: formatDateKey(today) === dateKey,
      subscriptions: renewalsByDate.get(dateKey) ?? [],
    });
  }

  const trailingEmptyDays = (7 - (days.length % 7)) % 7;
  return days.concat(
    Array.from({ length: trailingEmptyDays }, () => ({ subscriptions: [] })),
  );
}

function chunkCalendarWeeks(days: CalendarDay[]) {
  const weeks: CalendarDay[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return weeks;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
