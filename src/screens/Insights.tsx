import { useEffect, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";

import { EmptyState, Metric, ScreenTitle } from "../components/common";
import { styles } from "../styles";
import type { Colors } from "../theme";
import type { BillingPeriod, Subscription } from "../types";
import { colorFor } from "../utils/category";
import {
  formatMoney,
  isSubscriptionPaused,
  monthlyCost,
  type CurrencyTotal,
} from "../utils/subscriptions";

type InsightsProps = {
  c: Colors;
  subscriptions: Subscription[];
  activeSubscriptions: Subscription[];
  monthly: CurrencyTotal[];
  savedMonthly: CurrencyTotal[];
  convertedMonthlyAmounts: Record<string, number | null>;
  displayCurrency: string;
  convertToPrimaryCurrency: boolean;
  showOriginalCurrency: boolean;
};

export function Insights({
  c,
  subscriptions,
  activeSubscriptions,
  monthly,
  savedMonthly,
  convertedMonthlyAmounts,
  displayCurrency,
  convertToPrimaryCurrency,
  showOriginalCurrency,
}: InsightsProps) {
  const { width } = useWindowDimensions();
  const [viewedMonth, setViewedMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const useCompactMetricGrid = width < 560;
  const breakdownItems = activeSubscriptions.map((item) => {
    const amount = displayMonthlyCost(item, convertedMonthlyAmounts, convertToPrimaryCurrency);

    return {
      amount,
      color: item.iconColor ?? item.backgroundColor ?? colorFor(item.category),
      convertedMonthlyAmount: convertedMonthlyAmounts[item.id],
      item,
    };
  });
  const breakdownTotal = breakdownItems.reduce((total, item) => total + item.amount, 0);
  const calendarDays = buildRenewalCalendar(activeSubscriptions, viewedMonth);
  const calendarWeeks = chunkCalendarWeeks(calendarDays);
  const autoSelectedDateKey = defaultSelectedCalendarDate(calendarDays);
  const selectedDay = calendarDays.find((day) => day.dateKey === selectedDateKey);
  const hasPausedSubscriptions = subscriptions.some(isSubscriptionPaused);
  const monthLabel = viewedMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const selectedDateLabel = selectedDateKey
    ? new Date(`${selectedDateKey}T00:00:00`).toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    : null;

  function changeViewedMonth(offset: number) {
    setViewedMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    setSelectedDateKey(null);
  }

  useEffect(() => {
    if (!selectedDateKey && autoSelectedDateKey) {
      setSelectedDateKey(autoSelectedDateKey);
    }
  }, [autoSelectedDateKey, selectedDateKey]);

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <ScreenTitle c={c} title="Insights" />
      <View style={[styles.metricGrid, useCompactMetricGrid && styles.metricGridCompact]}>
        <Metric
          c={c}
          label="Monthly"
          style={useCompactMetricGrid && styles.metricCompact}
          value={formatCurrencyTotals(monthly)}
        />
        <Metric
          c={c}
          label="Yearly"
          style={useCompactMetricGrid && styles.metricCompact}
          value={formatCurrencyTotals(multiplyCurrencyTotals(monthly, 12))}
        />
        {hasPausedSubscriptions ? (
          <>
            <Metric
              c={c}
              label="Saved monthly"
              style={useCompactMetricGrid && styles.metricCompact}
              value={formatCurrencyTotals(savedMonthly)}
            />
            <Metric
              c={c}
              label="Saved yearly"
              style={useCompactMetricGrid && styles.metricCompact}
              value={formatCurrencyTotals(multiplyCurrencyTotals(savedMonthly, 12))}
            />
          </>
        ) : null}
      </View>

      {subscriptions.length === 0 ? (
        <EmptyState c={c} />
      ) : activeSubscriptions.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Ionicons name="pause-circle-outline" size={34} color={c.primary} />
          <Text style={[styles.emptyTitle, { color: c.text }]}>No active subscriptions</Text>
          <Text style={[styles.emptyText, { color: c.textMuted }]}>
            Paused subscriptions are counted as savings and excluded from renewal insights.
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Monthly breakdown</Text>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <SubscriptionBreakdownPie
              c={c}
              convertToPrimaryCurrency={convertToPrimaryCurrency}
              displayCurrency={displayCurrency}
              items={breakdownItems}
              showOriginalCurrency={showOriginalCurrency}
              total={breakdownTotal}
            />
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
                  {week.map((day, dayIndex) => {
                    const isSelected = day.dateKey === selectedDateKey;
                    const hasSubscriptions = day.subscriptions.length > 0;
                    const dayBorderColor = isSelected
                      ? c.primary
                      : day.isToday
                        ? c.primary
                        : c.border;

                    return (
                      <Pressable
                        accessibilityLabel={
                          day.dateKey
                            ? `${day.dayOfMonth}, ${day.subscriptions.length} subscriptions`
                            : undefined
                        }
                        disabled={!day.dateKey}
                        key={day.dateKey ?? `empty-${weekIndex}-${dayIndex}`}
                        onPress={() => day.dateKey && setSelectedDateKey(day.dateKey)}
                        style={[
                          styles.calendarDay,
                          {
                            backgroundColor: day.dateKey ? c.surfaceMuted : "transparent",
                            borderColor: dayBorderColor,
                          },
                          isSelected && styles.calendarSelectedDay,
                        ]}
                      >
                        {day.dateKey ? (
                          <>
                            <Text style={[styles.calendarDayNumber, { color: c.text }]}>
                              {day.dayOfMonth}
                            </Text>
                            {hasSubscriptions ? (
                              <View
                                style={[
                                  styles.calendarCountBadge,
                                  { backgroundColor: c.primary },
                                ]}
                              >
                                <Text style={styles.calendarCountText}>
                                  {day.subscriptions.length}
                                </Text>
                              </View>
                            ) : null}
                          </>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
            {selectedDateLabel ? (
              <View style={[styles.calendarSelection, { borderTopColor: c.border }]}>
                <Text style={[styles.calendarSelectionTitle, { color: c.text }]}>
                  {selectedDateLabel}
                </Text>
                {selectedDay && selectedDay.subscriptions.length > 0 ? (
                  <View style={styles.subscriptionStack}>
                    {selectedDay.subscriptions.map((item, index) => (
                      <View
                        key={item.id}
                        style={[
                          styles.calendarSubscriptionRow,
                          { backgroundColor: c.surfaceMuted },
                          index === selectedDay.subscriptions.length - 1
                            && styles.lastSubscriptionPill,
                        ]}
                      >
                        <View
                          style={[
                            styles.calendarSubscriptionAccent,
                            {
                              backgroundColor:
                                item.backgroundColor ?? item.iconColor ?? colorFor(item.category),
                            },
                          ]}
                        />
                        <View style={styles.rowText}>
                          <Text style={[styles.calendarSubscriptionName, { color: c.text }]}>
                            {item.name}
                          </Text>
                          <Text style={[styles.calendarSubscriptionMeta, { color: c.textMuted }]}>
                            {item.category} · {item.billingPeriod}
                          </Text>
                        </View>
                        <Text style={[styles.calendarSubscriptionPrice, { color: c.text }]}>
                          {formatSubscriptionPrice(
                            item,
                            convertedMonthlyAmounts[item.id],
                            displayCurrency,
                            convertToPrimaryCurrency,
                            showOriginalCurrency,
                          )}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.calendarSelectionEmpty, { color: c.textMuted }]}>
                    No subscriptions renew this day.
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        </>
      )}
    </ScrollView>
  );
}

type BreakdownItem = {
  amount: number;
  color: string;
  convertedMonthlyAmount: number | null | undefined;
  item: Subscription;
};

const PIE_BREAKDOWN_BATCH_SIZE = 3;

function SubscriptionBreakdownPie({
  c,
  convertToPrimaryCurrency,
  displayCurrency,
  items,
  showOriginalCurrency,
  total,
}: {
  c: Colors;
  convertToPrimaryCurrency: boolean;
  displayCurrency: string;
  items: BreakdownItem[];
  showOriginalCurrency: boolean;
  total: number;
}) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [visibleItemCount, setVisibleItemCount] = useState(PIE_BREAKDOWN_BATCH_SIZE);
  const chartItems = items
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const visibleChartItems = chartItems.slice(0, visibleItemCount);
  const hasMoreChartItems = visibleItemCount < chartItems.length;
  const selectedItem = chartItems.find((item) => item.item.id === selectedItemId) ?? null;
  const effectiveSelectedItemId = selectedItem?.item.id ?? null;
  const pieSlices = buildPieSlices(chartItems, total, effectiveSelectedItemId);

  function showMoreChartItems() {
    setVisibleItemCount((current) => (
      Math.min(current + PIE_BREAKDOWN_BATCH_SIZE, chartItems.length)
    ));
  }

  function handleBreakdownScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!hasMoreChartItems) return;

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;

    if (distanceFromBottom <= 24) {
      showMoreChartItems();
    }
  }

  useEffect(() => {
    setVisibleItemCount(PIE_BREAKDOWN_BATCH_SIZE);
    setSelectedItemId(null);
  }, [items.length]);

  return (
    <Pressable onPress={() => setSelectedItemId(null)} style={styles.pieBreakdown}>
      <Pressable onPress={() => setSelectedItemId(null)} style={styles.pieChartWrap}>
        <Svg width={224} height={224} viewBox="0 0 224 224">
          <Circle cx={112} cy={112} fill="none" r={78} stroke={c.surfaceMuted} strokeWidth={34} />
          {chartItems.length === 0 ? null : chartItems.length === 1 ? (
            <Circle
              cx={112}
              cy={112}
              fill="none"
              r={78}
              stroke={chartItems[0].color}
              strokeLinecap="round"
              strokeWidth={effectiveSelectedItemId === chartItems[0].item.id ? 42 : 34}
            />
          ) : (
            pieSlices.map((slice) => (
              <Path
                d={slice.path}
                fill={effectiveSelectedItemId && effectiveSelectedItemId !== slice.key ? c.surfaceMuted : slice.color}
                key={slice.key}
              />
            ))
          )}
        </Svg>
        <View
          pointerEvents="none"
          style={[
            styles.pieCenter,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
            },
          ]}
        >
          <Text style={[styles.pieCenterLabel, { color: c.textMuted }]}>
            {selectedItem ? `${itemPercentage(selectedItem, total)}%` : "Monthly"}
          </Text>
          <Text style={[styles.pieCenterValue, { color: c.text }]} numberOfLines={1}>
            {selectedItem ? selectedItem.item.name : "Breakdown"}
          </Text>
        </View>
      </Pressable>
      <ScrollView
        contentContainerStyle={styles.pieSubscriptionListContent}
        nestedScrollEnabled
        onScroll={handleBreakdownScroll}
        scrollEventThrottle={120}
        showsVerticalScrollIndicator={false}
        style={styles.pieSubscriptionList}
      >
        {visibleChartItems.map((chartItem) => {
          const isSelected = chartItem.item.id === effectiveSelectedItemId;

          return (
            <Pressable
              key={chartItem.item.id}
              onPress={() => setSelectedItemId(isSelected ? null : chartItem.item.id)}
              style={[
                styles.pieSubscriptionRow,
                {
                  backgroundColor: isSelected ? c.primarySoft : c.surfaceMuted,
                  borderColor: isSelected ? c.primary : c.border,
                },
              ]}
            >
              <View style={[styles.pieSelectionAccent, { backgroundColor: chartItem.color }]} />
              <View style={styles.rowText}>
                <Text style={[styles.pieSelectionTitle, { color: c.text }]} numberOfLines={1}>
                  {chartItem.item.name}
                </Text>
                <Text style={[styles.pieLegendMeta, { color: c.textMuted }]}>
                  {chartItem.item.category} · {itemPercentage(chartItem, total)}%
                </Text>
              </View>
              <Text style={[styles.pieSelectionPrice, { color: c.text }]}>
                {formatSubscriptionMonthlyCost(
                  chartItem.item,
                  chartItem.convertedMonthlyAmount,
                  displayCurrency,
                  convertToPrimaryCurrency,
                  showOriginalCurrency,
                )}
              </Text>
            </Pressable>
          );
        })}
        {hasMoreChartItems ? (
          <Pressable
            accessibilityRole="button"
            onPress={showMoreChartItems}
            style={[
              styles.pieShowMoreButton,
              {
                backgroundColor: c.surfaceMuted,
                borderColor: c.border,
              },
            ]}
          >
            <Text style={[styles.pieShowMoreText, { color: c.text }]}>Show more</Text>
            <Ionicons name="chevron-down" size={16} color={c.textMuted} />
          </Pressable>
        ) : null}
      </ScrollView>
    </Pressable>
  );
}

function buildPieSlices(items: BreakdownItem[], total: number, selectedItemId: string | null) {
  const center = 112;
  let currentAngle = -Math.PI / 2;

  return items.map((breakdownItem) => {
    const { amount, color, item } = breakdownItem;
    const sliceAngle = (amount / total) * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    const isSelected = item.id === selectedItemId;
    currentAngle = endAngle;

    return {
      color,
      key: item.id,
      path: donutSlicePath(
        center,
        center,
        isSelected ? 100 : 92,
        isSelected ? 48 : 56,
        startAngle,
        endAngle,
      ),
    };
  });
}

function donutSlicePath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
) {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function itemPercentage(item: BreakdownItem, total: number) {
  return total > 0 ? Math.round((item.amount / total) * 100) : 0;
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function displayMonthlyCost(
  item: Subscription,
  convertedMonthlyAmounts: Record<string, number | null | undefined>,
  convertToPrimaryCurrency: boolean,
) {
  if (!convertToPrimaryCurrency) return monthlyCost(item);
  return convertedMonthlyAmounts[item.id] ?? monthlyCost(item);
}

function formatSubscriptionMonthlyCost(
  item: Subscription,
  convertedMonthlyAmount: number | null | undefined,
  displayCurrency: string,
  convertToPrimaryCurrency: boolean,
  showOriginalCurrency: boolean,
) {
  const original = formatMoney(monthlyCost(item), item.currency);
  if (!convertToPrimaryCurrency || convertedMonthlyAmount == null) return original;

  const converted = formatMoney(convertedMonthlyAmount, displayCurrency);
  if (!showOriginalCurrency || item.currency === displayCurrency) return converted;
  return `${converted} (${original})`;
}

function formatSubscriptionPrice(
  item: Subscription,
  convertedMonthlyAmount: number | null | undefined,
  displayCurrency: string,
  convertToPrimaryCurrency: boolean,
  showOriginalCurrency: boolean,
) {
  const original = formatMoney(item.price, item.currency);
  if (!convertToPrimaryCurrency || convertedMonthlyAmount == null) return original;

  const originalMonthly = monthlyCost(item);
  const convertedPrice = originalMonthly > 0
    ? (convertedMonthlyAmount / originalMonthly) * item.price
    : convertedMonthlyAmount;
  const convertedMonthly = formatMoney(convertedPrice, displayCurrency);
  if (!showOriginalCurrency || item.currency === displayCurrency) return convertedMonthly;
  return `${convertedMonthly} (${original})`;
}

function formatCurrencyTotals(totals: CurrencyTotal[]) {
  if (totals.length === 0) return formatMoney(0, "EUR");
  return totals.map((total) => formatMoney(total.amount, total.currency)).join(" / ");
}

function multiplyCurrencyTotals(totals: CurrencyTotal[], multiplier: number) {
  return totals.map((total) => ({ ...total, amount: total.amount * multiplier }));
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
  const lastDay = new Date(year, month, daysInMonth);
  const leadingEmptyDays = (firstDay.getDay() + 6) % 7;
  const renewalsByDate = new Map<string, Subscription[]>();

  subscriptions.forEach((item) => {
    renewalDatesInMonth(item.nextRenewalDate, item.billingPeriod, firstDay, lastDay).forEach((renewal) => {
      const dateKey = formatDateKey(renewal);
      const existing = renewalsByDate.get(dateKey) ?? [];
      renewalsByDate.set(dateKey, [...existing, item]);
    });
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

function defaultSelectedCalendarDate(days: CalendarDay[]) {
  return days.find((day) => day.isToday)?.dateKey
    ?? days.find((day) => day.subscriptions.length > 0)?.dateKey
    ?? days.find((day) => day.dateKey)?.dateKey
    ?? null;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renewalDatesInMonth(
  firstRenewalDate: string,
  billingPeriod: BillingPeriod,
  monthStart: Date,
  monthEnd: Date,
) {
  const anchor = new Date(`${firstRenewalDate}T00:00:00`);
  if (anchor.getTime() > monthEnd.getTime()) return [];

  if (billingPeriod === "Weekly") {
    return weeklyRenewalDatesInMonth(anchor, monthStart, monthEnd);
  }

  const monthInterval = billingPeriodMonthInterval(billingPeriod);
  const monthOffset = monthDifference(anchor, monthStart);
  if (monthOffset < 0 || monthOffset % monthInterval !== 0) return [];

  const renewal = dateInMonth(monthStart.getFullYear(), monthStart.getMonth(), anchor.getDate());
  return renewal.getTime() >= anchor.getTime() ? [renewal] : [];
}

function weeklyRenewalDatesInMonth(anchor: Date, monthStart: Date, monthEnd: Date) {
  const dates: Date[] = [];
  const firstDate = new Date(Math.max(anchor.getTime(), monthStart.getTime()));
  const dayOffset = Math.ceil(dayDifference(anchor, firstDate) / 7) * 7;
  const firstRenewal = addDays(anchor, dayOffset);

  for (
    let renewal = firstRenewal;
    renewal.getTime() <= monthEnd.getTime();
    renewal = addDays(renewal, 7)
  ) {
    dates.push(renewal);
  }

  return dates;
}

function billingPeriodMonthInterval(billingPeriod: Exclude<BillingPeriod, "Weekly">) {
  if (billingPeriod === "3 months") return 3;
  if (billingPeriod === "6 months") return 6;
  if (billingPeriod === "Yearly") return 12;
  return 1;
}

function monthDifference(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
}

function dateInMonth(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

function dayDifference(start: Date, end: Date) {
  const millisecondsPerDay = 86_400_000;
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / millisecondsPerDay);
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
