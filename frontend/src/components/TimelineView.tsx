import { useMemo, useState, useRef, useCallback } from 'react';
import type { Board, Card } from '../types';

interface TimelineViewProps {
  board: Board;
  onCardClick: (card: Card) => void;
}

interface CardWithList extends Card {
  listTitle: string;
  listColor: string;
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const BAR_COLORS = [
  '#667eea', '#764ba2', '#f093fb', '#f5576c',
  '#0093E9', '#80D0C7', '#f59e0b', '#10b981',
];

const DAYS_VISIBLE = 28;
const DAY_WIDTH = 40;
const LEFT_PANEL_WIDTH = 220;
const ROW_HEIGHT = 36;
const LIST_HEADER_HEIGHT = 28;
const DAY_HEADER_HEIGHT = 48;
const DEFAULT_DURATION_DAYS = 3;

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000;
  const aStart = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bStart = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((bStart - aStart) / msPerDay);
}

function formatDate(date: Date): string {
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
}

export default function TimelineView({ board, onCardClick }: TimelineViewProps) {
  const [viewStart, setViewStart] = useState(() => getMonday(new Date()));
  const [collapsedLists, setCollapsedLists] = useState<Record<string, boolean>>({});
  const [tooltip, setTooltip] = useState<{
    card: CardWithList;
    x: number;
    y: number;
  } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  const visibleDays = useMemo(() => {
    return Array.from({ length: DAYS_VISIBLE }, (_, i) => {
      const d = new Date(viewStart);
      d.setDate(viewStart.getDate() + i);
      return d;
    });
  }, [viewStart]);

  const viewEnd = useMemo(() => {
    const d = new Date(viewStart);
    d.setDate(d.getDate() + DAYS_VISIBLE - 1);
    return d;
  }, [viewStart]);

  const headerLabel = useMemo(() => {
    const startMonth = MONTH_NAMES[viewStart.getMonth()];
    const endMonth = MONTH_NAMES[viewEnd.getMonth()];
    const startYear = viewStart.getFullYear();
    const endYear = viewEnd.getFullYear();

    if (startYear !== endYear) {
      return `${startMonth} ${startYear} — ${endMonth} ${endYear}`;
    }
    if (startMonth !== endMonth) {
      return `${startMonth} — ${endMonth} ${startYear}`;
    }
    return `${startMonth} ${startYear}`;
  }, [viewStart, viewEnd]);

  const { cardsByList, listsWithCards, totalCards } = useMemo(() => {
    const activeLists = board.lists?.filter((l: any) => !l.isArchived) || [];
    const result: Record<string, CardWithList[]> = {};
    let count = 0;

    activeLists.forEach((list: any, listIndex: number) => {
      const color = BAR_COLORS[listIndex % BAR_COLORS.length];
      const cards = (list.cards || [])
        .filter((c: Card) => !c.isArchived && (c.startDate || c.dueDate))
        .map((c: Card) => ({
          ...c,
          listTitle: list.title,
          listColor: color,
        }));
      if (cards.length > 0) {
        result[list.id] = cards;
        count += cards.length;
      }
    });

    return {
      cardsByList: result,
      listsWithCards: activeLists.filter((l: any) => result[l.id]),
      totalCards: count,
    };
  }, [board]);

  const goToPrev = useCallback(() => {
    setViewStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);

  const goToNext = useCallback(() => {
    setViewStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);

  const goToToday = useCallback(() => {
    setViewStart(getMonday(new Date()));
  }, []);

  const toggleList = useCallback((listId: string) => {
    setCollapsedLists((prev) => ({ ...prev, [listId]: !prev[listId] }));
  }, []);

  const handleScroll = useCallback(() => {
    if (timelineRef.current && leftPanelRef.current) {
      leftPanelRef.current.scrollTop = timelineRef.current.scrollTop;
    }
  }, []);

  const handleLeftScroll = useCallback(() => {
    if (timelineRef.current && leftPanelRef.current) {
      timelineRef.current.scrollTop = leftPanelRef.current.scrollTop;
    }
  }, []);

  const getBarInfo = useCallback(
    (card: CardWithList) => {
      const start = card.startDate ? new Date(card.startDate) : null;
      const end = card.dueDate ? new Date(card.dueDate) : null;

      let barStart: Date;
      let barEnd: Date;
      let isDiamond = false;

      if (start && end) {
        barStart = start;
        barEnd = end;
      } else if (end && !start) {
        // Only due date: diamond marker
        barStart = end;
        barEnd = end;
        isDiamond = true;
      } else if (start && !end) {
        // Only start date: extend default duration
        barStart = start;
        barEnd = new Date(start);
        barEnd.setDate(barEnd.getDate() + DEFAULT_DURATION_DAYS - 1);
      } else {
        return null;
      }

      const viewStartTime = new Date(
        viewStart.getFullYear(),
        viewStart.getMonth(),
        viewStart.getDate()
      ).getTime();
      const viewEndDate = new Date(viewStart);
      viewEndDate.setDate(viewEndDate.getDate() + DAYS_VISIBLE - 1);

      const barStartNorm = new Date(
        barStart.getFullYear(),
        barStart.getMonth(),
        barStart.getDate()
      );
      const barEndNorm = new Date(
        barEnd.getFullYear(),
        barEnd.getMonth(),
        barEnd.getDate()
      );

      // Check if bar is visible at all
      if (barEndNorm.getTime() < viewStartTime) return null;
      if (
        barStartNorm.getTime() >
        viewStartTime + (DAYS_VISIBLE - 1) * 86400000
      )
        return null;

      const startOffset = daysBetween(viewStart, barStartNorm);
      const endOffset = daysBetween(viewStart, barEndNorm);

      const clippedStart = Math.max(0, startOffset);
      const clippedEnd = Math.min(DAYS_VISIBLE - 1, endOffset);

      const left = clippedStart * DAY_WIDTH;
      const width = isDiamond ? 14 : (clippedEnd - clippedStart + 1) * DAY_WIDTH - 4;

      // Check overdue
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const isOverdue = end ? barEndNorm.getTime() < now.getTime() : false;
      const isCompleted = card.isCompleted || false;

      return {
        left: isDiamond ? left + DAY_WIDTH / 2 - 7 : left + 2,
        width: Math.max(width, isDiamond ? 14 : 8),
        isDiamond,
        isOverdue: isOverdue && !isCompleted,
        isCompleted,
        clippedLeft: startOffset < 0,
        clippedRight: endOffset > DAYS_VISIBLE - 1,
      };
    },
    [viewStart]
  );

  const renderBar = useCallback(
    (card: CardWithList) => {
      const info = getBarInfo(card);
      if (!info) return null;

      const baseColor = info.isOverdue
        ? '#ef4444'
        : info.isCompleted
          ? '#10b981'
          : card.listColor;

      if (info.isDiamond) {
        return (
          <div
            style={{
              position: 'absolute',
              left: info.left,
              top: (ROW_HEIGHT - 14) / 2,
              width: 14,
              height: 14,
              background: baseColor,
              transform: 'rotate(45deg)',
              borderRadius: 2,
              cursor: 'pointer',
              opacity: info.isCompleted ? 0.5 : 1,
              zIndex: 1,
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onCardClick(card);
            }}
            onMouseEnter={(e) => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              setTooltip({ card, x: rect.left + rect.width / 2, y: rect.top - 4 });
            }}
            onMouseLeave={() => setTooltip(null)}
          />
        );
      }

      const showTitle = info.width > 80;

      return (
        <div
          style={{
            position: 'absolute',
            left: info.left,
            top: (ROW_HEIGHT - 22) / 2,
            width: info.width,
            height: 22,
            background: info.isCompleted
              ? `${baseColor}80`
              : baseColor,
            borderRadius: info.clippedLeft && info.clippedRight
              ? 0
              : info.clippedLeft
                ? '0 4px 4px 0'
                : info.clippedRight
                  ? '4px 0 0 4px'
                  : 4,
            cursor: 'pointer',
            opacity: info.isCompleted ? 0.5 : 0.9,
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            padding: '0 6px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            transition: 'opacity 0.15s, box-shadow 0.15s',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onCardClick(card);
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.opacity = '1';
            el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
            const rect = el.getBoundingClientRect();
            setTooltip({ card, x: rect.left + rect.width / 2, y: rect.top - 4 });
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.opacity = info.isCompleted ? '0.5' : '0.9';
            el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.15)';
            setTooltip(null);
          }}
        >
          {info.isCompleted && (
            <span style={{ marginRight: 4, fontSize: 11, lineHeight: 1 }}>&#10003;</span>
          )}
          {showTitle && (
            <span
              style={{
                fontSize: 11,
                color: '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontWeight: 500,
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}
            >
              {card.title}
            </span>
          )}
        </div>
      );
    },
    [getBarInfo, onCardClick]
  );

  // Button styles
  const navBtnStyle: React.CSSProperties = {
    background: 'var(--surface-card, #1e1e2e)',
    border: '1px solid var(--border-accent, #333)',
    borderRadius: 6,
    color: 'var(--text-primary, #e0e0e0)',
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    transition: 'background 0.15s',
  };

  // Empty state
  if (totalCards === 0) {
    return (
      <div
        style={{
          background: 'var(--surface-card)',
          borderRadius: 16,
          border: '1px solid var(--border-accent)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 24px',
          textAlign: 'center',
          minHeight: 300,
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>&#128197;</div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 8,
          }}
        >
          Nenhum card com datas
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 320 }}>
          Adicione datas de in&iacute;cio ou vencimento aos seus cards para visualiz&aacute;-los na linha do tempo.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        borderRadius: 16,
        border: '1px solid var(--border-accent)',
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Navigation Header */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--surface-input)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            style={navBtnStyle}
            onClick={goToPrev}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover, #2a2a3e)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface-card, #1e1e2e)')}
            title="Semana anterior"
          >
            &#8592;
          </button>
          <button
            style={{ ...navBtnStyle, padding: '4px 14px' }}
            onClick={goToToday}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover, #2a2a3e)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface-card, #1e1e2e)')}
          >
            Hoje
          </button>
          <button
            style={navBtnStyle}
            onClick={goToNext}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover, #2a2a3e)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface-card, #1e1e2e)')}
            title="Pr&oacute;xima semana"
          >
            &#8594;
          </button>
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {headerLabel}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {totalCards} {totalCards === 1 ? 'card com data' : 'cards com datas'}
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left panel - card names */}
        <div
          ref={leftPanelRef}
          onScroll={handleLeftScroll}
          style={{
            width: LEFT_PANEL_WIDTH,
            flexShrink: 0,
            borderRight: '1px solid var(--border-accent)',
            overflowY: 'auto',
            overflowX: 'hidden',
            background: 'var(--surface-input)',
            scrollbarWidth: 'none',
          }}
        >
          {/* Day header spacer */}
          <div
            style={{
              height: DAY_HEADER_HEIGHT,
              borderBottom: '1px solid var(--border-accent)',
              position: 'sticky',
              top: 0,
              zIndex: 3,
              background: 'var(--surface-input)',
            }}
          />

          {/* List sections */}
          {listsWithCards.map((list: any, listIndex: number) => {
            const isCollapsed = collapsedLists[list.id];
            const cards = cardsByList[list.id];
            const color = BAR_COLORS[listIndex % BAR_COLORS.length];

            return (
              <div key={list.id}>
                {/* List header */}
                <div
                  style={{
                    height: LIST_HEADER_HEIGHT,
                    padding: '0 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: '1px solid var(--border-accent)',
                    background: 'var(--surface-subtle, rgba(255,255,255,0.02))',
                  }}
                  onClick={() => toggleList(list.id)}
                >
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.15s',
                      display: 'inline-block',
                    }}
                  >
                    &#9660;
                  </span>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {list.title}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {cards.length}
                  </span>
                </div>

                {/* Card rows */}
                {!isCollapsed &&
                  cards.map((card: CardWithList) => (
                    <div
                      key={card.id}
                      style={{
                        height: ROW_HEIGHT,
                        padding: '0 12px',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        borderBottom: '1px solid var(--border-accent)',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        transition: 'background 0.1s',
                      }}
                      onClick={() => onCardClick(card)}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          'var(--surface-hover, rgba(255,255,255,0.03))')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = 'transparent')
                      }
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {card.title}
                      </span>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>

        {/* Right panel - timeline grid */}
        <div
          ref={timelineRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflow: 'auto',
          }}
        >
          {/* Day headers */}
          <div
            style={{
              display: 'flex',
              height: DAY_HEADER_HEIGHT,
              borderBottom: '1px solid var(--border-accent)',
              position: 'sticky',
              top: 0,
              zIndex: 2,
              background: 'var(--surface-input)',
              minWidth: DAYS_VISIBLE * DAY_WIDTH,
            }}
          >
            {visibleDays.map((day, i) => {
              const today = isToday(day);
              const weekend = isWeekend(day);
              const isFirstOfMonth = day.getDate() === 1;

              return (
                <div
                  key={i}
                  style={{
                    width: DAY_WIDTH,
                    flexShrink: 0,
                    textAlign: 'center',
                    borderRight: '1px solid var(--border-accent)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 2,
                    opacity: weekend ? 0.5 : 1,
                    background: today
                      ? 'var(--accent-bg-subtle, rgba(102,126,234,0.08))'
                      : 'transparent',
                    borderLeft: isFirstOfMonth
                      ? '2px solid var(--text-muted)'
                      : 'none',
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      fontWeight: 500,
                      lineHeight: 1,
                    }}
                  >
                    {isFirstOfMonth
                      ? MONTH_NAMES[day.getMonth()].slice(0, 3).toUpperCase()
                      : DAY_NAMES[day.getDay()]}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: today ? 700 : 400,
                      color: today
                        ? 'var(--accent-primary, #667eea)'
                        : 'var(--text-secondary, #aaa)',
                      lineHeight: 1,
                      width: 22,
                      height: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      background: today
                        ? 'var(--accent-primary, #667eea)'
                        : 'transparent',
                      ...(today ? { color: '#fff' } : {}),
                    }}
                  >
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Card rows with bars */}
          <div style={{ minWidth: DAYS_VISIBLE * DAY_WIDTH }}>
            {listsWithCards.map((list: any) => {
              const isCollapsed = collapsedLists[list.id];
              const cards = cardsByList[list.id];

              return (
                <div key={list.id}>
                  {/* List header spacer row */}
                  <div
                    style={{
                      height: LIST_HEADER_HEIGHT,
                      borderBottom: '1px solid var(--border-accent)',
                      background: 'var(--surface-subtle, rgba(255,255,255,0.02))',
                      position: 'relative',
                      display: 'flex',
                    }}
                  >
                    {/* Grid columns in header spacer */}
                    {visibleDays.map((_day, i) => (
                      <div
                        key={i}
                        style={{
                          width: DAY_WIDTH,
                          flexShrink: 0,
                          borderRight: '1px solid rgba(128,128,128,0.06)',
                        }}
                      />
                    ))}
                  </div>

                  {/* Card rows */}
                  {!isCollapsed &&
                    cards.map((card: CardWithList) => (
                      <div
                        key={card.id}
                        style={{
                          height: ROW_HEIGHT,
                          position: 'relative',
                          borderBottom: '1px solid var(--border-accent)',
                          display: 'flex',
                        }}
                      >
                        {/* Background grid cells */}
                        {visibleDays.map((day, i) => (
                          <div
                            key={i}
                            style={{
                              width: DAY_WIDTH,
                              flexShrink: 0,
                              borderRight: '1px solid rgba(128,128,128,0.06)',
                              background: isToday(day)
                                ? 'var(--accent-bg-subtle, rgba(102,126,234,0.05))'
                                : isWeekend(day)
                                  ? 'rgba(0,0,0,0.02)'
                                  : 'transparent',
                            }}
                          />
                        ))}

                        {/* Card bar */}
                        {renderBar(card)}
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Today vertical line */}
      {(() => {
        const todayIndex = visibleDays.findIndex(isToday);
        if (todayIndex === -1) return null;
        return (
          <div
            style={{
              position: 'absolute',
              left: LEFT_PANEL_WIDTH + todayIndex * DAY_WIDTH + DAY_WIDTH / 2,
              top: DAY_HEADER_HEIGHT + 44, // Below nav + day headers
              bottom: 0,
              width: 2,
              background: 'var(--accent-primary, #667eea)',
              opacity: 0.3,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        );
      })()}

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            background: 'var(--surface-card, #1e1e2e)',
            border: '1px solid var(--border-accent, #333)',
            borderRadius: 8,
            padding: '8px 12px',
            zIndex: 100,
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            maxWidth: 260,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {tooltip.card.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <div>
              <span style={{ opacity: 0.7 }}>Lista: </span>
              {tooltip.card.listTitle}
            </div>
            {tooltip.card.startDate && (
              <div>
                <span style={{ opacity: 0.7 }}>In&iacute;cio: </span>
                {formatDate(new Date(tooltip.card.startDate))}
              </div>
            )}
            {tooltip.card.dueDate && (
              <div>
                <span style={{ opacity: 0.7 }}>Vencimento: </span>
                {formatDate(new Date(tooltip.card.dueDate))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
