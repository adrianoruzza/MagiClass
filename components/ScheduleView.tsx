
import React, { useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { CLASS_COLORS, MONTH_HEADER_STYLES } from '../constants';
import { Lesson, DayOfWeek, LessonNote, SpecialDay, Recess, Subject, ClassEntity, SchoolYear, ProvisionalSchedulePeriod } from '../types';
import { isDateInProvisionalPeriod, getEffectiveTimeSlotsForDate, getEffectiveTimeSlotsForWeek, getMondayDateStrFromDate } from '../utils/provisionalSchedule';
import { isDisposizioneLesson } from '../utils/repetitionUtils';
import { formatLastBackupTimestamp } from '../utils/deviceBackup';
import { findNoteForLessonUnified } from '../utils/noteLookup';
import { Plus, Check, ChevronLeft, ChevronRight, Calendar, Copy, Circle, X, Undo2, Redo2, Coffee, LayoutGrid, RectangleHorizontal, UserMinus, Users, Stethoscope, School, ChevronDown, Ban, GripHorizontal, ArrowRight, Clock, Settings, Search, MapPin, Filter, Repeat, Save } from 'lucide-react';
import AppIcon from './AppIcon';

interface ScheduleViewProps {
  schedule: Lesson[];
  provisionalPeriods?: ProvisionalSchedulePeriod[];
  lessonNotes?: LessonNote[];
  lastBackupTime?: string | null;
  currentDate: Date;
  schoolStartDate: Date;
  semesterSplitDate?: Date;
  specialDays?: SpecialDay[];
  timeSlots: Record<number, string>;
  recesses: Recess[];
  subjects: Subject[];
  classes?: ClassEntity[];
  schoolYears: SchoolYear[];
  schoolEndDate: Date;
  activeDays: DayOfWeek[];
  maxHours: number;
  highlightedLessonId: string | null;
  focusClass: string | null;
  weekCount?: string;
  onLessonClick: (lesson: Lesson, dateStr: string) => void;
  onEmptySlotClick: (day: DayOfWeek, hour: number, dateStr?: string) => void;
  onNavigate: (direction: 'prev' | 'next' | 'today') => void;
  onOpenStartDateModal: () => void;
  onCopyPreviousWeek: () => void;
  onDayHeaderClick: (date: Date) => void;
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
  onOpenBackup: () => void;
  onOpenGuide: () => void;
  onTimeSlotClick: (hour: number) => void;
  onOpenRecessModal: () => void;
  onOpenMonthPicker?: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onOpenRemainingHours: () => void;
  onOpenClassFilter: () => void;
  onSwapLessons: (sourceLessonId: string, targetDay: DayOfWeek, targetHour: number, sourceDateStr?: string, targetDateStr?: string) => void;
  onUpdateNoteStatus: (lessonId: string, dateStr: string, field: 'toCheck' | 'toDo' | 'misc', text: string, status: 'done' | 'not_done' | 'pending' | 'none') => void;
  onMoveNoteItem: (lessonId: string, dateStr: string, field: 'toCheck' | 'toDo' | 'misc', text: string) => void;
  onToggleREStatus: (lessonId: string, dateStr: string) => void;
  onToggleVotoStatus: (lessonId: string, dateStr: string) => void;
  onQuickBackup?: () => void;
  isQuickBackupSaving?: boolean;
  initialMobileWeekView?: boolean;
  initialActiveMobileTab?: number;
  sessionRestoreKey?: number;
  initialMobileScrollTop?: number;
  initialDesktopScrollTop?: number;
  onUiViewChange?: (state: { isMobileWeekView: boolean; activeMobileTab: number }) => void;
  onScrollPositionChange?: (key: 'scheduleMobileDay' | 'scheduleDesktopGrid', scrollTop: number) => void;
}

const getLocalDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const QuickActionMenu = ({ 
    isOpen, 
    onClose, 
    onAction,
    status 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    onAction: (action: 'done' | 'not_done' | 'pending' | 'move') => void;
    status: 'done' | 'not_done' | 'pending' | 'none';
}) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-magi-fade" 
            onClick={(e) => {
                e.stopPropagation();
                onClose();
            }}
        >
             <div 
                className="bg-white rounded-2xl shadow-2xl p-4 w-64 border border-slate-100 animate-magi-scale"
                onClick={(e) => e.stopPropagation()}
             >
                <div className="flex flex-col gap-2">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2 px-1 tracking-widest">Azioni Rapide</p>
                    
                    <button 
                        onClick={() => onAction('done')}
                        className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all magi-press ${status === 'done' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'}`}
                    >
                        <div className={`p-1.5 rounded-full ${status === 'done' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            <Check className="w-4 h-4" strokeWidth={3} />
                        </div>
                        Fatto
                    </button>

                    <button 
                         onClick={() => onAction('not_done')}
                        className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all magi-press ${status === 'not_done' ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-slate-50 text-slate-700 hover:bg-rose-50 hover:text-rose-700'}`}
                    >
                        <div className={`p-1.5 rounded-full ${status === 'not_done' ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            <X className="w-4 h-4" strokeWidth={3} />
                        </div>
                        Non Fatto
                    </button>

                     <button 
                        onClick={() => onAction('pending')}
                        className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all magi-press ${status === 'pending' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-50 text-slate-700 hover:bg-amber-50 hover:text-amber-700'}`}
                    >
                        <div className={`p-1.5 rounded-full ${status === 'pending' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            <Clock className="w-4 h-4" strokeWidth={3} />
                        </div>
                        Da Finire
                    </button>

                    <div className="h-px bg-slate-100 my-2 mx-2"></div>

                     <button 
                        onClick={() => onAction('move')}
                        className="flex items-center gap-3 p-3 rounded-xl text-sm font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all border border-indigo-100 magi-press"
                    >
                        <div className="p-1.5 rounded-full bg-indigo-200 text-indigo-700">
                            <ArrowRight className="w-4 h-4" strokeWidth={3} />
                        </div>
                        Sposta a Prossima
                    </button>
                </div>
             </div>
        </div>
    );
};

const AutoScrollWrapper = ({ children, className }: { children?: React.ReactNode, className?: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [offset, setOffset] = useState(0);
    const [isManual, setIsManual] = useState(false);

    const checkOverflow = useCallback(() => {
        const container = containerRef.current;
        const content = contentRef.current;
        if (!container || !content) return;

        const containerHeight = container.clientHeight;
        const contentHeight = content.scrollHeight;
        const diff = contentHeight - containerHeight;
        
        if (diff > 1) { 
            setOffset(diff); 
        } else {
            setOffset(0);
        }
    }, []);

    useLayoutEffect(() => {
        const container = containerRef.current;
        const content = contentRef.current;
        
        if (!container || !content) return;

        const resizeObserver = new ResizeObserver(() => {
            checkOverflow();
        });

        resizeObserver.observe(container);
        resizeObserver.observe(content);

        const mutationObserver = new MutationObserver(checkOverflow);
        mutationObserver.observe(content, { 
            childList: true, 
            subtree: true, 
            characterData: true,
            attributes: true 
        });

        checkOverflow();

        return () => {
            resizeObserver.disconnect();
            mutationObserver.disconnect();
        };
    }, [checkOverflow, children]);

    useEffect(() => {
        setIsManual(false);
    }, [children]);

    const hasOverflow = offset > 0;

    const style = (hasOverflow && !isManual) ? {
        '--scroll-offset': `-${offset}px`,
        animation: 'vertical-shuttle 10s ease-in-out infinite' 
    } as React.CSSProperties : {};

    return (
        <div 
            ref={containerRef} 
            className={`relative h-full w-full ${className || ''} ${isManual ? 'overflow-y-auto scrollbar-thin' : 'overflow-hidden'}`}
            onWheel={() => {
                if (hasOverflow && !isManual) setIsManual(true);
            }}
            onTouchMove={() => {
                if (hasOverflow && !isManual) setIsManual(true);
            }}
            onClick={(e) => {
                if (hasOverflow && !isManual) {
                    setIsManual(true);
                    e.stopPropagation(); 
                }
            }}
        >
            <div 
                ref={contentRef} 
                style={style} 
                className={`w-full flex flex-col ${hasOverflow && !isManual ? 'will-change-transform' : ''}`}
            >
                {children}
            </div>
        </div>
    );
};

const ScheduleView: React.FC<ScheduleViewProps> = ({ 
  schedule, 
  provisionalPeriods = [],
  lessonNotes = [], 
  lastBackupTime = null,
  currentDate,
  schoolStartDate: _schoolStartDate,
  semesterSplitDate,
  specialDays = [],
  timeSlots,
  recesses,
  subjects,
  classes = [],
  schoolYears,
  schoolEndDate: _schoolEndDate,
  activeDays,
  maxHours,
  highlightedLessonId,
  focusClass,
  weekCount,
  onLessonClick, 
  onEmptySlotClick,
  onNavigate,
  onOpenStartDateModal: _onOpenStartDateModal,
  onCopyPreviousWeek,
  onDayHeaderClick,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onOpenBackup: _onOpenBackup,
  onOpenGuide: _onOpenGuide,
  onTimeSlotClick,
  onOpenRecessModal,
  onOpenMonthPicker,
  onOpenSettings,
  onOpenSearch,
  onOpenRemainingHours,
  onOpenClassFilter,
  onSwapLessons,
  onUpdateNoteStatus,
  onMoveNoteItem,
  onToggleREStatus,
  onToggleVotoStatus,
  onQuickBackup,
  isQuickBackupSaving = false,
  initialMobileWeekView,
  initialActiveMobileTab,
  sessionRestoreKey = 0,
  initialMobileScrollTop = 0,
  initialDesktopScrollTop = 0,
  onUiViewChange,
  onScrollPositionChange
}) => {
  const hoursArray = useMemo(() => Array.from({ length: maxHours }, (_, i) => i + 1), [maxHours]);

  const [activeMobileTab, setActiveMobileTab] = useState<number>(() => {
    if (typeof initialActiveMobileTab === 'number' && initialActiveMobileTab >= 0 && initialActiveMobileTab < activeDays.length) {
      return initialActiveMobileTab;
    }
    const day = currentDate.getDay(); 
    const idx = day - 1; 
    return (idx >= 0 && idx < activeDays.length) ? idx : 0;
  });
  const [isMobileWeekView, setIsMobileWeekView] = useState<boolean>(Boolean(initialMobileWeekView));

  const mobileDayScrollRef = useRef<HTMLDivElement | null>(null);
  const desktopGridScrollRef = useRef<HTMLDivElement | null>(null);
  const lastAppliedSessionKeyRef = useRef<number>(0);
  const skipNextDateTabSyncRef = useRef<boolean>(false);

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStart = useRef<{ x: number, y: number } | null>(null);
  const pinchStartDist = useRef<number | null>(null); 
  const startTime = useRef<number>(0);
  
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingSourceDate, setDraggingSourceDate] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ day: DayOfWeek, hour: number, dateStr: string } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingMobileRef = useRef(false);

  const [quickMenu, setQuickMenu] = useState<{
      isOpen: boolean;
      lessonId: string;
      dateStr: string;
      field: 'toCheck' | 'toDo' | 'misc';
      text: string;
      status: 'done' | 'not_done' | 'pending' | 'none';
  } | null>(null);

  // Applica lo stato di visualizzazione e scorrimento ripristinato dalla sessione precedente
  useEffect(() => {
    if (!sessionRestoreKey || sessionRestoreKey === lastAppliedSessionKeyRef.current) return;
    lastAppliedSessionKeyRef.current = sessionRestoreKey;

    if (typeof initialMobileWeekView === 'boolean') {
      setIsMobileWeekView(initialMobileWeekView);
    }
    if (typeof initialActiveMobileTab === 'number' && initialActiveMobileTab >= 0 && initialActiveMobileTab < activeDays.length) {
      skipNextDateTabSyncRef.current = true;
      setActiveMobileTab(initialActiveMobileTab);
    }

    const restoreFrame = requestAnimationFrame(() => {
      if (mobileDayScrollRef.current && initialMobileScrollTop > 0) {
        mobileDayScrollRef.current.scrollTop = initialMobileScrollTop;
      }
      if (desktopGridScrollRef.current && initialDesktopScrollTop > 0) {
        desktopGridScrollRef.current.scrollTop = initialDesktopScrollTop;
      }
    });

    return () => cancelAnimationFrame(restoreFrame);
  }, [sessionRestoreKey, initialMobileWeekView, initialActiveMobileTab, initialMobileScrollTop, initialDesktopScrollTop, activeDays.length]);

  useEffect(() => {
    if (skipNextDateTabSyncRef.current) {
      skipNextDateTabSyncRef.current = false;
      return;
    }
    const day = currentDate.getDay();
    let targetIdx = 0;
    
    if (day === 0) {
        targetIdx = 0;
    } else {
        targetIdx = day - 1;
        if (targetIdx >= activeDays.length) {
            targetIdx = activeDays.length - 1;
        }
    }
    
    setActiveMobileTab(targetIdx);
  }, [currentDate, activeDays]);

  useEffect(() => {
    if (onUiViewChange) {
      onUiViewChange({ isMobileWeekView, activeMobileTab });
    }
  }, [isMobileWeekView, activeMobileTab, onUiViewChange]);

  const handleDragStart = (e: React.DragEvent, lessonId: string, sourceDateStr: string) => {
      e.dataTransfer.setData("text/plain", lessonId);
      e.dataTransfer.setData("sourceDate", sourceDateStr);
      setDraggingId(lessonId);
      setDraggingSourceDate(sourceDateStr);
  };

  const handleDragOver = (e: React.DragEvent, day: DayOfWeek, hour: number, dateStr: string) => {
      e.preventDefault(); 
      e.dataTransfer.dropEffect = "move";
      if (!dragOverSlot || dragOverSlot.day !== day || dragOverSlot.hour !== hour) {
          setDragOverSlot({ day, hour, dateStr });
      }
  };

  const handleDrop = (e: React.DragEvent, day: DayOfWeek, hour: number, targetDateStr: string) => {
      e.preventDefault();
      const sourceLessonId = e.dataTransfer.getData("text/plain") || draggingId;
      const sourceDateStr = e.dataTransfer.getData("sourceDate") || draggingSourceDate;
      
      if (sourceLessonId) {
          onSwapLessons(sourceLessonId, day, hour, sourceDateStr || undefined, targetDateStr);
      }
      setDraggingId(null);
      setDraggingSourceDate(null);
      setDragOverSlot(null);
  };

  const handleDragEnd = () => {
      setDraggingId(null);
      setDraggingSourceDate(null);
      setDragOverSlot(null);
  };

  const handleTouchStart = (e: React.TouchEvent, lessonId: string, sourceDateStr: string) => {
      if (isAnimating) return;
      if (e.touches.length === 2) {
        const dist = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY
        );
        pinchStartDist.current = dist;
        return;
    }
    if (!isMobileWeekView || window.innerWidth >= 768) {
        setIsSwiping(true);
        touchStart.current = {
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        };
        startTime.current = Date.now();
    }

    if (lessonId) {
        longPressTimer.current = setTimeout(() => {
            setDraggingId(lessonId);
            setDraggingSourceDate(sourceDateStr);
            isDraggingMobileRef.current = true;
            setIsSwiping(false); 
            if (navigator.vibrate) navigator.vibrate(50); 
        }, 600); 
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (isDraggingMobileRef.current) {
          e.preventDefault(); 
          const touch = e.touches[0];
          const target = document.elementFromPoint(touch.clientX, touch.clientY);
          const slot = target?.closest('[data-day][data-hour]');
          if (slot) {
              const day = slot.getAttribute('data-day') as DayOfWeek;
              const hour = parseInt(slot.getAttribute('data-hour') || '0', 10);
              const dateStr = slot.getAttribute('data-date') || '';
              if (day && hour) {
                  if (!dragOverSlot || dragOverSlot.day !== day || dragOverSlot.hour !== hour) {
                      setDragOverSlot({ day, hour, dateStr });
                  }
              }
          } else {
              setDragOverSlot(null);
          }
          return; 
      }

      if (touchStart.current) {
          const moveX = Math.abs(e.touches[0].clientX - touchStart.current.x);
          const moveY = Math.abs(e.touches[0].clientY - touchStart.current.y);
          if (moveX > 10 || moveY > 10) {
              if (longPressTimer.current) {
                  clearTimeout(longPressTimer.current);
                  longPressTimer.current = null;
              }
          }
      }
      
      if (e.touches.length === 2 && pinchStartDist.current !== null) {
          const dist = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY
          );
          
          const delta = dist - pinchStartDist.current;
          if (delta < -50 && !isMobileWeekView) {
              setIsMobileWeekView(true);
              pinchStartDist.current = null; 
          }
          else if (delta > 50 && isMobileWeekView) {
              setIsMobileWeekView(false);
              pinchStartDist.current = null;
          }
          return;
      }
      if (!touchStart.current || isAnimating || (isMobileWeekView && window.innerWidth < 768)) return;
      const currentX = e.targetTouches[0].clientX;
      const currentY = e.targetTouches[0].clientY;
      const diffX = currentX - touchStart.current.x;
      const diffY = currentY - touchStart.current.y;
      if (Math.abs(diffX) > Math.abs(diffY)) {
          if (e.cancelable) e.preventDefault();
          setSwipeOffset(diffX);
      }
  };

  const handleTouchEnd = (_e: React.TouchEvent) => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }

      if (isDraggingMobileRef.current) {
          if (draggingId && dragOverSlot) {
              onSwapLessons(draggingId, dragOverSlot.day, dragOverSlot.hour, draggingSourceDate!, dragOverSlot.dateStr);
          }
          setDraggingId(null);
          setDraggingSourceDate(null);
          setDragOverSlot(null);
          isDraggingMobileRef.current = false;
          return;
      }

      pinchStartDist.current = null; 
      if (!isSwiping || !touchStart.current || (isMobileWeekView && window.innerWidth < 768)) return;
      setIsSwiping(false);
      const touchDuration = Date.now() - startTime.current;
      const threshold = window.innerWidth * 0.12; // Slightly more responsive threshold
      const velocity = Math.abs(swipeOffset) / touchDuration;
      const isFlick = velocity > 0.35; 
      const screenWidth = window.innerWidth;
      let direction = 0; 
      if (swipeOffset < -threshold || (swipeOffset < -50 && isFlick)) {
          direction = -1; 
      } else if (swipeOffset > threshold || (swipeOffset > 50 && isFlick)) {
          direction = 1; 
      }
      if (direction !== 0) {
          setIsAnimating(true);
          const targetOffset = direction === -1 ? -screenWidth : screenWidth;
          setSwipeOffset(targetOffset);
          setTimeout(() => {
              if (direction === -1) {
                  if (window.innerWidth >= 768) onNavigate('next');
                  else handleMobileNavigate('next');
              } else {
                  if (window.innerWidth >= 768) onNavigate('prev');
                  else handleMobileNavigate('prev');
              }
              setSwipeOffset(0);
              setIsAnimating(false);
          }, 350);
      } else {
          setIsAnimating(true);
          setSwipeOffset(0);
          setTimeout(() => setIsAnimating(false), 300);
      }
      touchStart.current = null;
  };

  const getWeekDates = (baseDate: Date) => {
    const monday = new Date(baseDate);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);

    const dates = [];
    const numDays = activeDays.length;
    for (let i = 0; i < numDays; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate, activeDays]);
  const effectiveWeekTimeSlots = useMemo(() => {
    return getEffectiveTimeSlotsForWeek(weekDates, currentDate, provisionalPeriods, timeSlots);
  }, [weekDates, currentDate, provisionalPeriods, timeSlots]);
  const monthName = currentDate.toLocaleDateString('it-IT', { month: 'long' }).toUpperCase();
  const monthNameShort = currentDate.toLocaleDateString('it-IT', { month: 'short' }).toUpperCase().replace('.', '');
  const yearNum = currentDate.getFullYear();
  const monthIndex = currentDate.getMonth();

  const lastBackupFormatted = useMemo(() => {
    return formatLastBackupTimestamp(lastBackupTime);
  }, [lastBackupTime]);

  const activeSchoolYear = useMemo(() => {
    const dateStr = getLocalDateKey(currentDate);
    return schoolYears.find(y => dateStr >= y.startDate && dateStr <= y.endDate) || schoolYears[0];
  }, [currentDate, schoolYears]);

  const getLesson = (day: DayOfWeek, hour: number, date: Date) => {
    const dateStr = getLocalDateKey(date);
    const yearForDate = schoolYears.find(y => dateStr >= y.startDate && dateStr <= y.endDate) || schoolYears[0];
    if (!yearForDate) return null;

    const mondayKey = getMondayDateStrFromDate(date);
    const inProvisional = isDateInProvisionalPeriod(dateStr, provisionalPeriods);

    if (inProvisional) {
      const provLesson = schedule.find(l => 
        l.isProvisional && 
        l.weekStart === mondayKey && 
        l.day === day && 
        l.hour === hour && 
        (l.schoolYearId === yearForDate.id || (!l.schoolYearId && yearForDate.id === schoolYears[0]?.id))
      );
      if (provLesson) {
        if (provLesson.isDeleted || !provLesson.className) return null;
        return provLesson;
      }
      return null;
    }

    // 1. Look for week-specific definitive lesson
    const weekSpecific = schedule.find(l => 
      !l.isProvisional && 
      !l.isDeleted &&
      l.weekStart === mondayKey &&
      l.day === day && 
      l.hour === hour && 
      (l.schoolYearId === yearForDate.id || (!l.schoolYearId && yearForDate.id === schoolYears[0]?.id))
    );
    if (weekSpecific) {
      if (weekSpecific.isDeleted || !weekSpecific.className) return null;
      return weekSpecific;
    }

    // 2. Fallback to base schedule lesson (lessons without weekStart)
    return schedule.find(l => 
      !l.isProvisional && 
      !l.isDeleted &&
      !l.weekStart &&
      l.day === day && 
      l.hour === hour && 
      (l.schoolYearId === yearForDate.id || (!l.schoolYearId && yearForDate.id === schoolYears[0]?.id))
    ) || null;
  };

  const findNoteForLesson = (lessonId: string, dateStr: string, currentLesson?: Lesson | null): LessonNote | undefined => {
      return findNoteForLessonUnified(lessonNotes, lessonId, dateStr, currentLesson, schedule, subjects);
  };

  const getNotes = (lessonId: string, dateStr: string, currentLesson?: Lesson | null) => {
      const note = findNoteForLesson(lessonId, dateStr, currentLesson);
      if (!note) return null;
      
      const content: { text: string, status: 'done' | 'not_done' | 'pending' | 'none', prefix: string, field: 'toCheck' | 'toDo' | 'misc', fullLine: string }[] = [];

      const processLines = (text: string, prefix: string, field: 'toCheck' | 'toDo' | 'misc') => {
          if (!text) return;
          const lines = text.split('\n');
          lines.forEach(line => {
              let cleanLine = line.trim();
              if (!cleanLine) return;

              let status: 'done' | 'not_done' | 'pending' | 'none' = 'none';
              if (cleanLine.includes('{V}')) status = 'done';
              else if (cleanLine.includes('{X}')) status = 'not_done';
              else if (cleanLine.includes('{O}')) status = 'pending';

              cleanLine = cleanLine.replace('{V}', '').replace('{X}', '').replace('{O}', '').trim();
              content.push({ text: cleanLine, status, prefix, field, fullLine: cleanLine }); 
          });
      };

      processLines(note.toCheck, '[C]', 'toCheck');
      processLines(note.toDo, '[F]', 'toDo');
      processLines(note.misc, '[V]', 'misc');

      return content.length > 0 ? content : null;
  };

  const getSpecialDay = (date: Date) => {
      const dateStr = getLocalDateKey(date);
      return specialDays.find(sd => sd.date === dateStr);
  };

  const getSpecialDayConfig = (type: SpecialDay['type']) => {
      switch(type) {
          case 'ASSEMBLY': 
            return { 
                text: 'ASSEMBLEA', 
                bg: 'bg-purple-50', 
                border: 'border-purple-200',
                icon: <Users className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />,
                textColor: 'text-purple-800'
            };
          case 'PERMISSION': 
            return { 
                text: 'PERMESSO', 
                bg: 'bg-amber-50', 
                border: 'border-amber-200',
                icon: <UserMinus className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />,
                textColor: 'text-amber-800'
            };
          case 'SICK': 
            return { 
                text: 'MALATTIA', 
                bg: 'bg-red-50', 
                border: 'border-red-200',
                icon: <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />,
                textColor: 'text-red-800'
            };
          case 'SCHOOL_CLOSED': 
            return { 
                text: 'CHIUSO', 
                bg: 'bg-slate-100', 
                border: 'border-slate-300',
                icon: <School className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />,
                textColor: 'text-slate-800'
            };
          case 'TRIP': 
            return { 
                text: 'VISITA GUIDATA', 
                bg: 'bg-blue-50', 
                border: 'border-blue-200',
                icon: <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />,
                textColor: 'text-blue-800'
            };
          default: 
            return { 
                text: '', 
                bg: 'bg-white', 
                border: 'border-slate-200',
                icon: null,
                textColor: ''
            };
      }
  };

  const getSemesterLabel = (short: boolean = false) => {
      if (!semesterSplitDate) return "";
      const currentMonday = new Date(weekDates[0]);
      currentMonday.setHours(0,0,0,0);
      const split = new Date(semesterSplitDate);
      split.setHours(0,0,0,0);
      if (short) {
        return currentMonday < split ? "1° Q." : "2° Q.";
      }
      return currentMonday < split ? "1° QUADR." : "2° QUADR.";
  };

  const handleMobileNavigate = (direction: 'prev' | 'next') => {
      const maxIndex = activeDays.length - 1;
      if (direction === 'next') {
          if (activeMobileTab < maxIndex) {
              setActiveMobileTab(prev => prev + 1);
          } else {
              onNavigate('next');
          }
      } else {
          if (activeMobileTab > 0) {
              setActiveMobileTab(prev => prev - 1);
          } else {
              onNavigate('prev');
          }
      }
  };

  const handleMobileWeekHeaderClick = (index: number) => {
      setActiveMobileTab(index);
      setIsMobileWeekView(false);
  };

  const renderBadgeStyle = (status: 'done' | 'not_done' | 'pending' | 'none') => {
      switch(status) {
          case 'done': return 'bg-green-100 text-green-700 border-green-300/50 hover:bg-green-200 cursor-pointer';
          case 'not_done': return 'bg-red-100 text-red-700 border-red-300/50 hover:bg-red-200 cursor-pointer';
          case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-400/50 hover:bg-yellow-200 cursor-pointer';
          default: return 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer';
      }
  };

  const renderStatusIcon = (status: 'done' | 'not_done' | 'pending' | 'none') => {
      switch(status) {
          case 'done': return <Check className="w-3 h-3 flex-shrink-0" />;
          case 'not_done': return <X className="w-3 h-3 flex-shrink-0" />;
          case 'pending': return <Circle className="w-3 h-3 flex-shrink-0" />;
          default: return null;
      }
  };

  const cleanContent = (text: string) => text.replace(/^\[.*?\]:\s*/, '').replace(/\{[VXO]\}/g, '').trim();

  const isDatePast = (date: Date) => {
      const today = new Date();
      today.setHours(0,0,0,0);
      const target = new Date(date);
      target.setHours(0,0,0,0);
      return target < today;
  };

  const getLessonColorStyles = (lesson: Lesson) => {
      if (classes && classes.length > 0) {
          const cls = classes.find(c => c.name === lesson.className);
          if (cls) return cls.colorStyles;
      }
      if (CLASS_COLORS[lesson.className]) return CLASS_COLORS[lesson.className];
      if (lesson.subject) {
          const subj = subjects.find(s => s.name === lesson.subject);
          if (subj) return subj.colorStyles;
      }
      return 'bg-white border-l-4 border-slate-300 text-slate-700';
  };

  const SPECIAL_EVENT_HATCH_MAP: Record<string, { hatchClass: string; borderClass: string; textClass: string; iconClass: string }> = {
      red: { hatchClass: 'hatch-red', borderClass: 'border-red-300/80', textClass: 'text-red-900', iconClass: 'text-red-700' },
      rose: { hatchClass: 'hatch-rose', borderClass: 'border-rose-300/80', textClass: 'text-rose-900', iconClass: 'text-rose-700' },
      pink: { hatchClass: 'hatch-pink', borderClass: 'border-pink-300/80', textClass: 'text-pink-900', iconClass: 'text-pink-700' },
      orange: { hatchClass: 'hatch-orange', borderClass: 'border-orange-300/80', textClass: 'text-orange-900', iconClass: 'text-orange-700' },
      amber: { hatchClass: 'hatch-amber', borderClass: 'border-amber-300/80', textClass: 'text-amber-900', iconClass: 'text-amber-700' },
      yellow: { hatchClass: 'hatch-yellow', borderClass: 'border-yellow-300/80', textClass: 'text-yellow-900', iconClass: 'text-yellow-700' },
      lime: { hatchClass: 'hatch-lime', borderClass: 'border-lime-300/80', textClass: 'text-lime-900', iconClass: 'text-lime-700' },
      green: { hatchClass: 'hatch-green', borderClass: 'border-green-300/80', textClass: 'text-green-900', iconClass: 'text-green-700' },
      emerald: { hatchClass: 'hatch-emerald', borderClass: 'border-emerald-300/80', textClass: 'text-emerald-900', iconClass: 'text-emerald-700' },
      teal: { hatchClass: 'hatch-teal', borderClass: 'border-teal-300/80', textClass: 'text-teal-900', iconClass: 'text-teal-700' },
      cyan: { hatchClass: 'hatch-cyan', borderClass: 'border-cyan-300/80', textClass: 'text-cyan-900', iconClass: 'text-cyan-700' },
      sky: { hatchClass: 'hatch-sky', borderClass: 'border-sky-300/80', textClass: 'text-sky-900', iconClass: 'text-sky-700' },
      blue: { hatchClass: 'hatch-blue', borderClass: 'border-blue-300/80', textClass: 'text-blue-900', iconClass: 'text-blue-700' },
      indigo: { hatchClass: 'hatch-indigo', borderClass: 'border-indigo-300/80', textClass: 'text-indigo-900', iconClass: 'text-indigo-700' },
      violet: { hatchClass: 'hatch-violet', borderClass: 'border-violet-300/80', textClass: 'text-violet-900', iconClass: 'text-violet-700' },
      purple: { hatchClass: 'hatch-purple', borderClass: 'border-purple-300/80', textClass: 'text-purple-900', iconClass: 'text-purple-700' },
      fuchsia: { hatchClass: 'hatch-fuchsia', borderClass: 'border-fuchsia-300/80', textClass: 'text-fuchsia-900', iconClass: 'text-fuchsia-700' },
      stone: { hatchClass: 'hatch-stone', borderClass: 'border-stone-300/80', textClass: 'text-stone-900', iconClass: 'text-stone-700' },
      slate: { hatchClass: 'hatch-slate', borderClass: 'border-slate-300/80', textClass: 'text-slate-900', iconClass: 'text-slate-700' },
      zinc: { hatchClass: 'hatch-zinc', borderClass: 'border-zinc-300/80', textClass: 'text-zinc-900', iconClass: 'text-zinc-700' },
      neutral: { hatchClass: 'hatch-neutral', borderClass: 'border-neutral-300/80', textClass: 'text-neutral-900', iconClass: 'text-neutral-700' },
      gray: { hatchClass: 'hatch-gray', borderClass: 'border-gray-300/80', textClass: 'text-gray-900', iconClass: 'text-gray-700' }
  };

  const getSpecialEventHatchStyle = (lessonColorStyle: string) => {
      const bgMatch = lessonColorStyle.match(/\bbg-(red|rose|pink|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|stone|slate|zinc|neutral|gray)-/);
      const fallbackMatch = bgMatch || lessonColorStyle.match(/\b(?:border|text)-(red|rose|pink|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|stone|slate|zinc|neutral|gray)-/);
      const family = fallbackMatch?.[1] || 'slate';
      return SPECIAL_EVENT_HATCH_MAP[family] || SPECIAL_EVENT_HATCH_MAP.slate;
  };

  const getLessonSubjectName = useCallback((lesson: Lesson): string => {
      if (lesson.subject && lesson.subject.trim()) {
          return lesson.subject.trim();
      }
      if (classes && classes.length > 0) {
          const cls = classes.find(c => c.name === lesson.className);
          if (cls && cls.subjectIds && cls.subjectIds.length > 0) {
              const sub = subjects.find(s => s.id === cls.subjectIds![0]);
              if (sub && sub.name) return sub.name;
          }
      }
      return '';
  }, [classes, subjects]);

  const getTimeSlotDisplay = useCallback((hourNum: number, slots: Record<number, string>) => {
      const rawSlot = slots[hourNum] || "00:00 - 00:00";
      const parts = rawSlot.includes(' - ') ? rawSlot.split(' - ') : rawSlot.split('-');
      const startTimeStr = parts[0]?.trim() || "00:00";
      const endTimeStr = parts[1]?.trim() || "00:00";

      const assocRecess = recesses.find(r => r.associatedHour === hourNum);

      if (assocRecess) {
          let startDisplay = startTimeStr;
          if (assocRecess.afterHour === hourNum - 1) {
              const rawPrev = slots[assocRecess.afterHour];
              if (rawPrev) {
                  const prevParts = rawPrev.includes(' - ') ? rawPrev.split(' - ') : rawPrev.split('-');
                  startDisplay = prevParts[1]?.trim() || startTimeStr;
              } else {
                  const [h, m] = startTimeStr.split(':').map(Number);
                  if (!isNaN(h) && !isNaN(m)) {
                      const totalMin = Math.max(0, h * 60 + m - assocRecess.duration);
                      startDisplay = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
                  }
              }
          } else if (assocRecess.afterHour) {
              const rawTarget = slots[assocRecess.afterHour];
              if (rawTarget) {
                  const targetParts = rawTarget.includes(' - ') ? rawTarget.split(' - ') : rawTarget.split('-');
                  startDisplay = targetParts[1]?.trim() || startTimeStr;
              }
          }

          let endDisplay = endTimeStr;
          if (assocRecess.afterHour === hourNum) {
              const [h, m] = endTimeStr.split(':').map(Number);
              if (!isNaN(h) && !isNaN(m)) {
                  const totalMin = h * 60 + m + assocRecess.duration;
                  endDisplay = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
              }
          }

          return {
              hasAssociatedRecess: true,
              recessStart: startDisplay,
              recessDuration: `+${assocRecess.duration}m`,
              effectiveEnd: endDisplay,
              nominalStart: startTimeStr,
              nominalEnd: endTimeStr,
              recess: assocRecess,
          };
      }

      return {
          hasAssociatedRecess: false,
          recessStart: startTimeStr,
          recessDuration: '',
          effectiveEnd: endTimeStr,
          nominalStart: startTimeStr,
          nominalEnd: endTimeStr,
          recess: null,
      };
  }, [recesses]);

  const monthStyles = MONTH_HEADER_STYLES[monthIndex] || MONTH_HEADER_STYLES[8];

  const renderNoteGroups = (notes: any[], lessonId: string, dateStr: string, isCompact: boolean = false) => {
      if (!notes || notes.length === 0) return null;

      const checkList = notes.filter(n => n.prefix === '[C]');
      const doList = notes.filter(n => n.prefix === '[F]');
      const miscList = notes.filter(n => n.prefix === '[V]');

      if (isCompact) {
          return (
              <div className="flex flex-wrap gap-1 mt-1 portrait:flex-col portrait:items-start portrait:gap-0.5 animate-magi-fade">
                  {checkList.length > 0 && <div className="px-1 py-0.5 rounded bg-amber-100 border border-amber-300 text-[7px] portrait:text-[6.5px] font-black uppercase text-amber-700 leading-none shadow-sm">CONTROLL.</div>}
                  {doList.length > 0 && <div className="px-1 py-0.5 rounded bg-blue-100 border border-blue-300 text-[7px] portrait:text-[6.5px] font-black uppercase text-blue-700 leading-none shadow-sm">FARE</div>}
                  {miscList.length > 0 && <div className="px-1 py-0.5 rounded bg-violet-100 border border-violet-300 text-[7px] portrait:text-[6.5px] font-black uppercase text-violet-700 leading-none shadow-sm">VARIE</div>}
              </div>
          );
      }

      const handleNoteClick = (e: React.MouseEvent, noteItem: any) => {
          e.stopPropagation(); 
          setQuickMenu({
              isOpen: true,
              lessonId,
              dateStr,
              field: noteItem.field,
              text: noteItem.fullLine,
              status: noteItem.status
          });
      };

      return (
          <>
            {checkList.length > 0 && (
                <div className="mb-1 last:mb-0 rounded border border-amber-200 bg-amber-50 shrink-0 shadow-sm animate-magi-fade">
                    <div className="px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider text-amber-700 leading-none bg-amber-100/50 rounded-t">
                        Controllare
                    </div>
                    <div className="flex flex-col gap-0.5 p-1 pt-0.5">
                        {checkList.map((noteItem, idx) => (
                            <div 
                                key={idx} 
                                onClick={(e) => handleNoteClick(e, noteItem)}
                                className={`text-[9px] px-1 py-0.5 rounded border flex items-start gap-1 transition-transform magi-press ${renderBadgeStyle(noteItem.status)}`}
                            >
                                <div className="mt-0.5 shrink-0">{renderStatusIcon(noteItem.status)}</div>
                                <span className="font-medium flex-1 leading-tight whitespace-normal break-words select-none">
                                    {cleanContent(noteItem.text)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {doList.length > 0 && (
                <div className="mb-1 last:mb-0 rounded border border-blue-200 bg-blue-50 shrink-0 shadow-sm animate-magi-fade">
                     <div className="px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider text-blue-700 leading-none bg-blue-100/50 rounded-t">
                        Fare
                    </div>
                    <div className="flex flex-col gap-0.5 p-1 pt-0.5">
                        {doList.map((noteItem, idx) => (
                            <div 
                                key={idx} 
                                onClick={(e) => handleNoteClick(e, noteItem)}
                                className={`text-[9px] px-1 py-0.5 rounded border flex items-start gap-1 transition-transform magi-press ${renderBadgeStyle(noteItem.status)}`}
                            >
                                <div className="mt-0.5 shrink-0">{renderStatusIcon(noteItem.status)}</div>
                                <span className="font-medium flex-1 leading-tight whitespace-normal break-words select-none">
                                    {cleanContent(noteItem.text)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {miscList.length > 0 && (
                <div className="mb-1 last:mb-0 rounded border border-violet-200 bg-violet-50 shrink-0 shadow-sm animate-magi-fade">
                     <div className="px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider text-violet-700 leading-none bg-violet-100/50 rounded-t">
                        Varie
                    </div>
                    <div className="flex flex-col gap-0.5 p-1 pt-0.5">
                        {miscList.map((noteItem, idx) => (
                            <div 
                                key={idx} 
                                onClick={(e) => handleNoteClick(e, noteItem)}
                                className={`text-[9px] px-1 py-0.5 rounded border flex items-start gap-1 transition-transform magi-press ${renderBadgeStyle(noteItem.status)}`}
                            >
                                <div className="mt-0.5 shrink-0">{renderStatusIcon(noteItem.status)}</div>
                                <span className="font-medium flex-1 leading-tight whitespace-normal break-words select-none">
                                    {cleanContent(noteItem.text)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </>
      );
  };

  const renderSyncBadges = (lessonId: string, dateStr: string, isSmall?: boolean, forceStacked?: boolean, lessonObj?: Lesson | null) => {
      const lesson = lessonObj || schedule.find(s => s.id === lessonId);
      const note = findNoteForLesson(lessonId, dateStr, lesson);
      
      const hasItemsToCheck = Boolean(note?.toCheck && note.toCheck.trim().length > 0);

      // Tipologie di attività programmate che richiedono l'indicatore RE:
      // 1. Compito di teoria (oral_exam)
      // 2. Compito pratico (practical_exam)
      // 3. Compito scritto (written_exam)
      // 4. Consegna elaborato (submission o testo 'CONSEGNA ELABORAT...')
      const isTheoryExam = note?.type === 'oral_exam' ||
          Boolean(note?.toDo && /COMPITO\s+(DI\s+)?TEORIA/i.test(note.toDo)) ||
          Boolean(note?.toCheck && /COMPITO\s+(DI\s+)?TEORIA/i.test(note.toCheck)) ||
          Boolean(note?.misc && /COMPITO\s+(DI\s+)?TEORIA/i.test(note.misc));

      const isPracticalExam = note?.type === 'practical_exam' ||
          Boolean(note?.toDo && /COMPITO\s+PRATICO/i.test(note.toDo)) ||
          Boolean(note?.toCheck && /COMPITO\s+PRATICO/i.test(note.toCheck)) ||
          Boolean(note?.misc && /COMPITO\s+PRATICO/i.test(note.misc));

      const isWrittenExam = note?.type === 'written_exam' ||
          Boolean(note?.toDo && /COMPITO\s+SCRITTO/i.test(note.toDo)) ||
          Boolean(note?.toCheck && /COMPITO\s+SCRITTO/i.test(note.toCheck)) ||
          Boolean(note?.misc && /COMPITO\s+SCRITTO/i.test(note.misc));

      const isSubmission = (note as any)?.type === 'submission' ||
          Boolean(note?.toDo && /CONSEGNA.*ELABORAT/i.test(note.toDo)) ||
          Boolean(note?.toCheck && /CONSEGNA.*ELABORAT/i.test(note.toCheck)) ||
          Boolean(note?.misc && /CONSEGNA.*ELABORAT/i.test(note.misc));

      const isScheduledActivity = Boolean(isTheoryExam || isPracticalExam || isWrittenExam || isSubmission);
      const showREBadge = Boolean(hasItemsToCheck || isScheduledActivity);

      const hasVoteTask = Boolean(note?.misc && (
          note.misc.includes('VOTI:') ||
          note.votoSynced === true
      ));
      
      if (!showREBadge && !hasVoteTask) return null;

      const isRESynced = note?.reSynced || false;
      const isVotoSynced = note?.votoSynced || false;

      let reTitle = isRESynced ? "Segnato su Registro Elettronico" : "Da segnare su Registro Elettronico";
      if (!isRESynced && isScheduledActivity) {
          if (isTheoryExam) reTitle = "Compito di teoria da segnare su Registro Elettronico";
          else if (isPracticalExam) reTitle = "Compito pratico da segnare su Registro Elettronico";
          else if (isWrittenExam) reTitle = "Compito scritto da segnare su Registro Elettronico";
          else if (isSubmission) reTitle = "Consegna elaborato da segnare su Registro Elettronico";
      }

      return (
          <div className={`flex items-center gap-1 ${forceStacked ? 'flex-col portrait:items-start' : ''}`}>
              {showREBadge && (
                  <button
                      onClick={(e) => {
                          e.stopPropagation();
                          onToggleREStatus(lessonId, dateStr);
                      }}
                      className={`flex items-center justify-center px-2 py-0.5 rounded-full transition-all duration-300 shadow-md border shrink-0 min-h-[14px] min-w-[24px] magi-press
                          ${isRESynced 
                            ? 'bg-emerald-500 border-emerald-600 text-white scale-110 shadow-emerald-200' 
                            : 'bg-amber-400 border-amber-500 text-white animate-re-attention-pulse shadow-amber-200'
                          }
                          ${isSmall ? 'scale-75 origin-left' : 'scale-90 md:scale-75 lg:scale-100'}
                          ${forceStacked ? 'portrait:scale-[0.65] portrait:px-1 portrait:origin-top-left' : ''}
                      `}
                      title={reTitle}
                  >
                      <span className={`font-black tracking-tighter ${isSmall ? 'text-[7px]' : 'text-[9px]'}`}>RE</span>
                  </button>
              )}
              {hasVoteTask && (
                  <button
                      onClick={(e) => {
                          e.stopPropagation();
                          onToggleVotoStatus(lessonId, dateStr);
                      }}
                      className={`flex items-center justify-center px-2 py-0.5 rounded-full transition-all duration-300 shadow-md border shrink-0 min-h-[14px] min-w-[24px] magi-press
                          ${isVotoSynced 
                            ? 'bg-blue-600 border-blue-700 text-white scale-110 shadow-blue-200' 
                            : 'bg-blue-400 border-blue-500 text-white animate-voto-attention-pulse shadow-blue-200'
                          }
                          ${isSmall ? 'scale-75 origin-left' : 'scale-90 md:scale-75 lg:scale-100'}
                          ${forceStacked ? 'portrait:scale-[0.65] portrait:px-1 portrait:origin-top-left portrait:-mt-1' : ''}
                      `}
                      title={isVotoSynced ? "Voti trascritti" : "Voti da trascrivere"}
                  >
                      <span className={`font-black tracking-tighter ${isSmall ? 'text-[7px]' : 'text-[9px]'}`}>VOTO</span>
                  </button>
              )}
          </div>
      );
  };

  const renderMobileDayContent = (tabIndex: number, date: Date, isCurrentPanel: boolean = false) => {
      const isToday = date.toDateString() === new Date().toDateString();
      const isPast = isDatePast(date);
      const dayName = activeDays[tabIndex]; 
      const specialDay = getSpecialDay(date);

      if (specialDay) {
          const { text, bg, icon, textColor } = getSpecialDayConfig(specialDay.type);
          return (
              <div className={`w-full h-full flex flex-col bg-white border-r border-slate-200 flex-shrink-0 relative overflow-hidden`}>
                  <div 
                    className={`py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center justify-between border-b border-slate-200 cursor-pointer shrink-0 ${isToday ? 'bg-primary/5' : 'bg-slate-50'}`}
                    onClick={() => onDayHeaderClick(date)}
                  >
                        <div className="flex items-baseline gap-1.5 sm:gap-2 overflow-hidden">
                            <h2 className={`text-base sm:text-lg font-black uppercase truncate ${isToday ? 'text-primary' : 'text-slate-800'}`}>{dayName}</h2>
                            <p className={`text-[11px] sm:text-xs font-bold ${isToday ? 'text-primary' : 'text-slate-500'} truncate`}>
                                {date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
                            </p>
                        </div>
                        {isToday && <span className="text-[8px] sm:text-[9px] font-bold text-white bg-primary px-1.5 py-0.5 rounded-full whitespace-nowrap">OGGI</span>}
                   </div>
                   
                   <div 
                      className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${bg}`}
                      onClick={() => onDayHeaderClick(date)}
                    >
                        <div className="absolute inset-0 opacity-10 pointer-events-none"
                            style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 20px)' }}
                        ></div>

                        <div className="bg-white p-6 rounded-3xl shadow-xl z-10 flex flex-col items-center border border-slate-100 max-w-[280px] animate-magi-scale">
                            <div className={`mb-4 p-4 rounded-full ${bg} border-2 ${textColor.replace('text', 'border')}`}>
                                {icon}
                            </div>
                            <h3 className={`text-xl font-black ${textColor} uppercase mb-2`}>{text}</h3>
                            <p className="text-sm text-slate-500 font-medium">
                                Nessuna lezione programmata per questa giornata.
                            </p>
                            <span className="mt-4 text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                                Clicca per modificare
                            </span>
                        </div>
                   </div>
              </div>
          );
      }

      return (
          <div
            ref={isCurrentPanel ? mobileDayScrollRef : undefined}
            onScroll={isCurrentPanel && onScrollPositionChange ? (e) => onScrollPositionChange('scheduleMobileDay', e.currentTarget.scrollTop) : undefined}
            className={`w-full h-full flex flex-col overflow-y-auto bg-white border-r border-slate-200 flex-shrink-0 ${isPast ? 'opacity-70 grayscale' : ''}`}
          >
             <div 
                className={`py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center justify-between border-b border-slate-200 cursor-pointer shrink-0 ${isToday ? 'bg-primary/5' : 'bg-slate-50'}`}
                onClick={() => onDayHeaderClick(date)}
            >
                 <div className="flex items-baseline gap-1.5 sm:gap-2 overflow-hidden">
                     <h2 className={`text-base sm:text-lg font-black uppercase truncate ${isToday ? 'text-primary' : 'text-slate-800'}`}>{dayName}</h2>
                     <p className={`text-[11px] sm:text-xs font-bold ${isToday ? 'text-primary' : 'text-slate-500'} truncate`}>
                         {date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
                     </p>
                 </div>
                 {isToday && <span className="text-[8px] sm:text-[9px] font-bold text-white bg-primary px-1.5 py-0.5 rounded-full whitespace-nowrap">OGGI</span>}
            </div>

            <div className="flex-1 flex flex-col pb-6 min-h-0">
                {hoursArray.map(hour => {
                    const lesson = getLesson(dayName, hour, date);
                    const dateStr = getLocalDateKey(date);
                    
                    const rawNote = lesson ? findNoteForLesson(lesson.id, dateStr, lesson) : undefined;
                    const notes = lesson ? getNotes(lesson.id, dateStr, lesson) : null;
                    const isAssembly = rawNote?.type === 'assembly';
                    const isTrip = rawNote?.type === 'trip';
                    const isSkipped = rawNote?.type === 'skipped_lesson';
                    const isPractical = rawNote?.type === 'practical_exam';
                    const isOral = rawNote?.type === 'oral_exam';
                    const isWritten = rawNote?.type === 'written_exam';

                    const recess = recesses.find(r => r.afterHour === hour);
                    const isRecessTime = !!recess;
                    const isAssociatedToNextHour = recess?.associatedHour === hour + 1;
                    const isAssociatedToCurrentHour = recess?.associatedHour === hour;

                    const recessAbove = recesses.find(r => r.afterHour === hour - 1);
                    const isAssociatedWithRecessAbove = recessAbove?.associatedHour === hour;
                    
                    const recessHeightClass = 'h-4 sm:h-4.5 md:h-5';
                    const recessTextSize = 'text-[7.5px] sm:text-[8px] md:text-[8px]';

                    const lessonColorStyle = lesson ? getLessonColorStyles(lesson) : 'bg-slate-100';
                    const specialEventHatch = getSpecialEventHatchStyle(lessonColorStyle);
                    const rowClass = lesson ? 'flex-[10]' : 'flex-none';
                    const minHeightClass = lesson ? 'min-h-[140px]' : 'h-5.5 min-h-[22px]';

                    const isBeingDragged = lesson && draggingId === lesson.id && draggingSourceDate === dateStr;
                    const isDragTarget = dragOverSlot && dragOverSlot.day === dayName && dragOverSlot.hour === hour && dragOverSlot.dateStr === dateStr;
                    const isHighlighted = (lesson && lesson.id === highlightedLessonId) || (focusClass && lesson && lesson.className === focusClass);
                    const isDimmed = focusClass && lesson && lesson.className !== focusClass;

                    const effectiveDayTimeSlots = getEffectiveTimeSlotsForDate(dateStr, provisionalPeriods, timeSlots);
                    const dayTimeInfo = getTimeSlotDisplay(hour, effectiveDayTimeSlots);
                    const hasToDo = rawNote?.toDo && rawNote.toDo.trim().length > 0;
                    const mobileSubjectName = lesson ? getLessonSubjectName(lesson) : '';

                    const isSlotEmpty = !lesson || lesson.className === 'BUCO';

                    return (
                    <React.Fragment key={hour}>
                        <div className={`flex border-b border-slate-100 transition-all ${rowClass} ${minHeightClass}`}>
                            {!isSlotEmpty ? (
                                <div 
                                    className={`w-10 md:w-11 lg:w-14 bg-slate-50 border-r border-slate-200 flex flex-col items-center justify-start pt-3 shrink-0 cursor-pointer active:bg-slate-100 transition-colors overflow-hidden ${
                                      isAssociatedWithRecessAbove ? 'border-t-0' : ''
                                    }`}
                                    onClick={() => onTimeSlotClick(hour)}
                                    title={`Modifica orario ${hour}° ora${dayTimeInfo.recess ? ` (include ricreazione di ${dayTimeInfo.recess.duration} min)` : ''}`}
                                >
                                    <span className="text-lg md:text-xl font-black text-slate-300 leading-tight">{hour}°</span>
                                    {dayTimeInfo.hasAssociatedRecess ? (
                                      <div className="flex flex-col items-center mt-1 text-[7px] md:text-[8px] text-slate-400 font-bold uppercase tracking-tighter leading-none tabular-nums">
                                        <span className="whitespace-nowrap font-bold text-slate-500">{dayTimeInfo.recessStart}</span>
                                        <span className="text-[6.5px] md:text-[7px] font-extrabold text-amber-600 my-0.5 tracking-tight">{dayTimeInfo.recessDuration}</span>
                                        <span className="whitespace-nowrap font-bold text-slate-500">{dayTimeInfo.effectiveEnd}</span>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center mt-1 text-[7px] md:text-[8px] text-slate-400 font-bold uppercase tracking-tighter leading-none tabular-nums">
                                        <span className="whitespace-nowrap">{dayTimeInfo.nominalStart}</span>
                                        <div className="h-px w-3 bg-slate-200 my-0.5" />
                                        <span className="whitespace-nowrap">{dayTimeInfo.nominalEnd}</span>
                                      </div>
                                    )}
                                </div>
                            ) : (
                                <div 
                                    className={`w-10 md:w-11 lg:w-14 bg-slate-50 border-r border-slate-200 flex items-center justify-center px-0.5 py-0.5 shrink-0 cursor-pointer active:bg-slate-100 transition-colors overflow-hidden ${
                                      isAssociatedWithRecessAbove ? 'border-t-0' : ''
                                    }`}
                                    onClick={() => onTimeSlotClick(hour)}
                                    title={`Modifica orario ${hour}° ora${dayTimeInfo.recess ? ` (include ricreazione di ${dayTimeInfo.recess.duration} min)` : ''}`}
                                >
                                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 w-full h-full">
                                        <span className="text-[11px] sm:text-xs font-black text-slate-300 leading-none shrink-0">{hour}°</span>
                                        {dayTimeInfo.hasAssociatedRecess ? (
                                          <div className="flex flex-col items-center justify-center text-[5.5px] sm:text-[6.5px] md:text-[7.5px] text-slate-400 font-bold uppercase tracking-tighter leading-none shrink-0 tabular-nums">
                                            <span className="whitespace-nowrap font-bold text-slate-500">{dayTimeInfo.recessStart}</span>
                                            <span className="text-[5.5px] sm:text-[6px] font-extrabold text-amber-600 tracking-tight leading-none my-0.5">{dayTimeInfo.recessDuration}</span>
                                            <span className="whitespace-nowrap font-bold text-slate-500">{dayTimeInfo.effectiveEnd}</span>
                                          </div>
                                        ) : (
                                          <div className="flex flex-col items-center justify-center text-[5.5px] sm:text-[6.5px] md:text-[7.5px] text-slate-400 font-bold uppercase tracking-tighter leading-tight shrink-0 tabular-nums">
                                            <span className="whitespace-nowrap">{dayTimeInfo.nominalStart}</span>
                                            <span className="whitespace-nowrap">{dayTimeInfo.nominalEnd}</span>
                                          </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div 
                                className={`flex-1 relative min-w-0 transition-colors
                                    ${isDragTarget ? 'bg-primary/5 shadow-inner' : ''}
                                `}
                                onClick={() => lesson ? onLessonClick(lesson, dateStr) : onEmptySlotClick(dayName, hour, dateStr)}
                                data-day={dayName}
                                data-hour={hour}
                                data-date={dateStr}
                                onDragOver={(e) => handleDragOver(e, dayName, hour, dateStr)}
                                onDrop={(e) => handleDrop(e, dayName, hour, dateStr)}
                            >
                                {lesson ? (
                                    <div 
                                        className={`w-full h-full p-2 flex flex-col ${lessonColorStyle} transition-all magi-press
                                            ${isBeingDragged ? 'opacity-40 scale-95 border-2 border-dashed border-slate-500' : ''}
                                            ${isHighlighted ? 'ring-inset ring-4 ring-primary/20 z-10 shadow-lg scale-[1.01]' : ''}
                                            ${isDimmed ? 'opacity-20 grayscale brightness-75 scale-95' : ''}
                                        `}
                                        draggable="false"
                                        onTouchStart={(e) => handleTouchStart(e, lesson.id, dateStr)}
                                    >
                                        <div className={`flex flex-col ${mobileSubjectName ? '-mt-1' : 'pt-0.5'} mb-1 shrink-0 relative pr-6`}>
                                            {mobileSubjectName && (
                                                <span 
                                                    className="text-xs font-bold tracking-wider uppercase opacity-75 truncate leading-tight select-none -mt-px"
                                                    title={mobileSubjectName}
                                                >
                                                    {mobileSubjectName}
                                                </span>
                                            )}
                                            <div className={`flex items-center gap-2 ${mobileSubjectName ? '-mt-2' : ''}`}>
                                                <span className="text-xl font-black truncate">{lesson.className}</span>
                                                {isDisposizioneLesson(lesson) && lesson.repeatMode && lesson.repeatMode !== 'none' && (
                                                  <span 
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-stone-200/80 text-stone-700 shadow-xs" 
                                                    title={lesson.repeatMode === 'weekly' ? 'Ripetizione: Ogni settimana' : 'Ripetizione: A settimane alterne'}
                                                  >
                                                    <Repeat className="w-2.5 h-2.5 text-stone-600" />
                                                    <span>{lesson.repeatMode === 'weekly' ? 'Ogni sett.' : 'Sett. alterne'}</span>
                                                  </span>
                                                )}
                                                {renderSyncBadges(lesson.id, dateStr, true, false, lesson)}
                                            </div>
                                            
                                            <div className="absolute right-[-4px] top-[-4px] flex items-center z-20">
                                                {hasToDo && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const textToCopy = rawNote.toDo.split('\n')
                                                                .map(line => line.replace(/\{[VXO]\}/g, '').trim())
                                                                .filter(l => l.length > 0)
                                                                .join('\n');
                                                            navigator.clipboard.writeText(textToCopy);
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors magi-press"
                                                        title="Copia contenuti 'Fare'"
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <div 
                                                    className="p-1.5 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 hidden md:block transition-colors"
                                                    draggable="true"
                                                    onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, lesson.id, dateStr); }}
                                                    onDragEnd={handleDragEnd}
                                                    onClick={(e) => e.stopPropagation()} 
                                                    title="Trascina per spostare"
                                                >
                                                    <GripHorizontal className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 min-h-0 relative">
                                            {isAssembly ? (
                                                 <div className={`w-full h-full flex flex-col items-center justify-center special-event-hatch ${specialEventHatch.hatchClass} rounded-lg border-2 ${specialEventHatch.borderClass} p-2 transition-all animate-magi-fade`}>
                                                    <Users className={`w-8 h-8 ${specialEventHatch.iconClass} special-event-label mb-1`} />
                                                    <span className={`text-[10px] font-black ${specialEventHatch.textClass} special-event-label uppercase text-center leading-tight`}>
                                                        ASSEMBLEA<br/>DI CLASSE
                                                     </span>
                                                 </div>
                                            ) : isTrip ? (
                                                <div className={`w-full h-full flex flex-col items-center justify-center special-event-hatch ${specialEventHatch.hatchClass} rounded-lg border-2 ${specialEventHatch.borderClass} p-2 transition-all animate-magi-fade`}>
                                                   <MapPin className={`w-8 h-8 ${specialEventHatch.iconClass} special-event-label mb-1`} />
                                                   <span className={`text-[10px] font-black ${specialEventHatch.textClass} special-event-label uppercase text-center leading-tight`}>
                                                       VISITA<br/>GUIDATA
                                                    </span>
                                                </div>
                                            ) : isSkipped ? (
                                                <div className={`w-full h-full flex flex-col items-center justify-center special-event-hatch ${specialEventHatch.hatchClass} rounded-lg border-2 ${specialEventHatch.borderClass} p-2 transition-all animate-magi-fade`}>
                                                    <Ban className={`w-8 h-8 ${specialEventHatch.iconClass} special-event-label mb-1`} />
                                                    <span className={`text-[10px] font-black ${specialEventHatch.textClass} special-event-label uppercase text-center leading-tight`}>
                                                        LEZIONE<br/>SALTATA
                                                    </span>
                                                 </div>
                                            ) : isPractical ? (
                                                <div className={`w-full h-full flex flex-col items-center justify-center special-event-hatch ${specialEventHatch.hatchClass} rounded-lg border-2 ${specialEventHatch.borderClass} p-2 transition-all animate-magi-fade`}>
                                                    <span className={`text-[10px] font-black ${specialEventHatch.textClass} special-event-label uppercase text-center leading-tight`}>
                                                        COMPITO<br/>PRATICO
                                                    </span>
                                                </div>
                                            ) : isOral ? (
                                                <div className={`w-full h-full flex flex-col items-center justify-center special-event-hatch ${specialEventHatch.hatchClass} rounded-lg border-2 ${specialEventHatch.borderClass} p-2 transition-all animate-magi-fade`}>
                                                    <span className={`text-[10px] font-black ${specialEventHatch.textClass} special-event-label uppercase text-center leading-tight`}>
                                                        COMPITO DI<br/>TEORIA
                                                    </span>
                                                </div>
                                            ) : isWritten ? (
                                                <div className={`w-full h-full flex flex-col items-center justify-center special-event-hatch ${specialEventHatch.hatchClass} rounded-lg border-2 ${specialEventHatch.borderClass} p-2 transition-all animate-magi-fade`}>
                                                    <span className={`text-[10px] font-black ${specialEventHatch.textClass} special-event-label uppercase text-center leading-tight`}>
                                                        COMPITO<br/>SCRITTO
                                                    </span>
                                                </div>
                                            ) : (
                                                <AutoScrollWrapper>
                                                    <div className="flex flex-col gap-1 w-full">
                                                        {renderNoteGroups(notes || [], lesson.id, dateStr)}
                                                    </div>
                                                </AutoScrollWrapper>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <div className="w-4 h-4 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center border border-slate-200 border-dashed magi-press">
                                            <Plus className="w-3 h-3" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {isRecessTime && (
                            <div className={`flex w-full ${recessHeightClass} items-stretch relative overflow-hidden shrink-0`}>
                                {/* Cella colonna laterale ore della ricreazione */}
                                <div className={`w-10 md:w-11 lg:w-14 flex-none border-r border-slate-200 bg-slate-50 flex items-center justify-center relative transition-colors ${
                                    isAssociatedToNextHour 
                                      ? 'border-b-0 border-t-2 border-slate-300 shadow-xs' 
                                      : isAssociatedToCurrentHour
                                        ? 'border-t-0 border-b-2 border-slate-300'
                                        : 'border-b border-slate-200'
                                }`}>
                                    {isAssociatedToNextHour && (
                                        <div className="flex items-center justify-center text-amber-500" title={`Ricreazione associata alla ${hour + 1}ª ora`}>
                                            <Coffee className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                        </div>
                                    )}
                                    {isAssociatedToCurrentHour && (
                                        <div className="flex items-center justify-center text-amber-500" title={`Ricreazione associata alla ${hour}ª ora`}>
                                            <Coffee className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                        </div>
                                    )}
                                </div>

                                {/* Banner Ricreazione */}
                                <div className="flex-1 relative flex items-center justify-center bg-slate-50 border-b border-slate-200 overflow-hidden">
                                    <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none" 
                                        style={{ backgroundImage: 'repeating-linear-gradient(45deg, #cbd5e1 0, #cbd5e1 1px, transparent 0, transparent 10px)' }}>
                                    </div>
                                    <span className={`relative bg-slate-50 px-1.5 sm:px-2 font-bold text-slate-400 uppercase tracking-wider md:tracking-widest z-10 leading-none ${recessTextSize}`}>
                                    RICREAZIONE
                                    </span>
                                </div>
                            </div>
                        )}
                    </React.Fragment>
                    );
                })}
            </div>
          </div>
      );
  };

  const mobilePanels = useMemo(() => {
      const maxIndex = activeDays.length - 1;
      let prevIdx = activeMobileTab - 1;
      if (prevIdx < 0) prevIdx = maxIndex;
      
      let nextIdx = activeMobileTab + 1;
      if (nextIdx > maxIndex) nextIdx = 0;
      
      const prevTargetDate = new Date(weekDates[activeMobileTab]);
      prevTargetDate.setDate(prevTargetDate.getDate() - 1);
      if (activeMobileTab === 0) {
          const m = new Date(weekDates[0]);
          m.setDate(m.getDate() - (8 - activeDays.length)); 
          prevTargetDate.setTime(m.getTime());
      }

      const nextTargetDate = new Date(weekDates[activeMobileTab]);
      nextTargetDate.setDate(nextTargetDate.getDate() + 1);
      if (activeMobileTab === maxIndex) {
          const f = new Date(weekDates[maxIndex]);
          f.setDate(f.getDate() + (8 - activeDays.length)); 
          nextTargetDate.setTime(f.getTime());
      }
      
      return {
          prev: { idx: prevIdx, date: weekDates[prevIdx] || prevTargetDate },
          curr: { idx: activeMobileTab, date: weekDates[activeMobileTab] },
          next: { idx: nextIdx, date: weekDates[nextIdx] || nextTargetDate }
      };

  }, [weekDates, activeMobileTab, activeDays]);


  return (
    <div className="flex flex-col w-full h-full bg-white select-none relative">
      
      {quickMenu && (
          <QuickActionMenu
              isOpen={quickMenu.isOpen}
              onClose={() => setQuickMenu(null)}
              status={quickMenu.status}
              onAction={(action) => {
                  if (action === 'move') {
                      onMoveNoteItem(quickMenu.lessonId, quickMenu.dateStr, quickMenu.field, quickMenu.text);
                  } else {
                      onUpdateNoteStatus(quickMenu.lessonId, quickMenu.dateStr, quickMenu.field, quickMenu.text, action);
                  }
                  setQuickMenu(null);
              }}
          />
      )}

      <style>{`
        @keyframes vertical-shuttle {
            0%, 25% { transform: translateY(0); }
            45%, 75% { transform: translateY(var(--scroll-offset)); }
            100% { transform: translateY(0); }
        }
        @keyframes re-attention-pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7); }
            50% { transform: scale(1.15); box-shadow: 0 0 0 12px rgba(251, 191, 36, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
        }
        @keyframes voto-attention-pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7); }
            50% { transform: scale(1.15); box-shadow: 0 0 0 12px rgba(37, 99, 235, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
        }
        .animate-re-attention-pulse {
            animation: re-attention-pulse 1.8s infinite cubic-bezier(0.4, 0, 0.6, 1);
        }
        .animate-voto-attention-pulse {
            animation: voto-attention-pulse 1.8s infinite cubic-bezier(0.4, 0, 0.6, 1) 0.9s;
        }
      `}</style>

      <div className={`${monthStyles.bg} border-b ${monthStyles.border} px-1.5 sm:px-3 lg:px-4 flex flex-col lg:flex-row lg:items-center justify-between shrink-0 transition-colors duration-500 relative overflow-hidden h-auto shadow-md py-1 lg:py-1.5`}>
        {/* ========================================================= */}
        {/* VERSIONE MOBILE (< md): AZIONI IN ALTO, MESE SOTTO       */}
        {/* ========================================================= */}
        <div className="flex md:hidden flex-col w-full gap-0.5">
          {/* Riga Superiore: Pulsanti di Azione */}
          <div className="flex items-center justify-between w-full">
            {/* Gruppo Sinistra: Icona App, Navigazione, Ore Residue, Filtro Classi, Switcher Vista */}
            <div className="flex items-center gap-1 min-[360px]:gap-1.5 min-[390px]:gap-2 sm:gap-2.5 shrink-0">
              <button
                onClick={() => onNavigate('today')}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden shrink-0 shadow-xs ring-1 ring-white/25 transition-transform active:scale-95"
                title="MagiClass - Torna a oggi"
                aria-label="MagiClass"
              >
                <AppIcon className="w-full h-full" />
              </button>

              <button 
                onClick={() => onNavigate('prev')} 
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-full transition-all magi-press shadow-xs shrink-0"
                title="Settimana precedente"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button 
                onClick={() => onNavigate('today')}
                className="h-7 sm:h-8 px-1.5 min-[360px]:px-2 sm:px-2.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-lg transition-all magi-press text-[10px] sm:text-xs font-bold shadow-xs flex items-center gap-1 border border-white/15 shrink-0"
                title="Torna a oggi"
              >
                <Calendar className="w-3 h-3 hidden sm:inline" />
                <span>Sett. {weekCount || "-"}</span>
                <span className="text-[8.5px] sm:text-[9.5px] opacity-75 font-black uppercase whitespace-nowrap">
                  {getSemesterLabel(true)}
                </span>
              </button>

              <button 
                onClick={() => onNavigate('next')} 
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-full transition-all magi-press shadow-xs shrink-0"
                title="Settimana successiva"
              >
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button 
                onClick={onOpenRemainingHours}
                className="w-7 h-7 sm:w-8 sm:h-8 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-full transition-all magi-press shadow-xs flex items-center justify-center font-bold text-xs sm:text-sm shrink-0"
                title="Ore residue"
              >
                h
              </button>

              <button 
                onClick={onOpenClassFilter}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-all magi-press shadow-xs flex items-center justify-center shrink-0 border ${
                  focusClass 
                  ? 'bg-white text-primary border-white scale-105 shadow-md font-bold' 
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
                }`}
                title="Filtra Classi"
              >
                <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button 
                onClick={() => setIsMobileWeekView(!isMobileWeekView)}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-lg transition-all magi-press shrink-0"
                title="Cambia Vista (Giorno/Settimana)"
              >
                {isMobileWeekView ? <RectangleHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              </button>
            </div>

            {/* Gruppo Destra: Ricerca, Impostazioni, Salva Backup (Floppy) */}
            <div className="flex items-center gap-1 min-[360px]:gap-1.5 min-[390px]:gap-2 sm:gap-2.5 shrink-0">

              <button 
                onClick={onOpenSearch}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-full transition-all magi-press shadow-xs shrink-0"
                title="Cerca Compiti"
              >
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button 
                onClick={onOpenSettings}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-full transition-all magi-press shadow-xs shrink-0"
                title="Impostazioni"
              >
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {onQuickBackup && (
                <button
                  onClick={onQuickBackup}
                  disabled={isQuickBackupSaving}
                  className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-full transition-all magi-press shadow-xs shrink-0 ${
                    isQuickBackupSaving ? 'opacity-60 animate-pulse cursor-wait' : ''
                  }`}
                  title="Salva backup"
                  aria-label="Salva backup"
                >
                  <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Riga Inferiore Mobile: Annulla (sx), Mese / Anno / A.S. (centro), Ripristina (dx) */}
          <div className="flex items-center justify-between w-full px-0.5 min-[360px]:px-1 -mt-0.5 min-w-0">
            {/* Annulla (Undo) - a sinistra */}
            <button 
              onClick={onUndo} 
              disabled={!canUndo}
              className={`w-[26px] h-[26px] min-[360px]:w-7 min-[360px]:h-7 flex items-center justify-center rounded-full transition-all magi-press shrink-0 ${
                canUndo ? 'bg-white/15 hover:bg-white/25 active:bg-white/35 text-white shadow-xs' : 'opacity-25 cursor-not-allowed text-white'
              }`}
              title="Annulla"
              aria-label="Annulla operazione"
            >
              <Undo2 className="w-3 h-3 min-[360px]:w-3.5 min-[360px]:h-3.5" />
            </button>

            {/* Informazioni Temporali - al centro dello spazio libero tra i pulsanti */}
            <div 
              onClick={onOpenMonthPicker}
              className="flex-1 flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 active:bg-white/20 rounded-md py-0.5 px-1 min-w-0 mx-0.5 transition-all magi-press"
              title="Seleziona Mese e Anno Scolastico"
            >
              <div className="flex items-center justify-center gap-1 min-[360px]:gap-1.5 min-w-0">
                <div className="flex items-baseline gap-1 min-w-0 shrink">
                  <span className={`font-black tracking-tight ${monthStyles.text} text-xs sm:text-sm drop-shadow-xs capitalize truncate`}>
                    {monthName}
                  </span>
                  <span className={`text-[11px] sm:text-xs font-light opacity-80 ${monthStyles.text} shrink-0`}>
                    {yearNum}
                  </span>
                </div>
                {activeSchoolYear && (
                  <span className="text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-wider bg-white/20 text-white px-1.5 py-0.2 rounded-full border border-white/20 shadow-xs shrink-0 whitespace-nowrap">
                    A.S. {activeSchoolYear.label}
                  </span>
                )}
                <ChevronDown className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${monthStyles.text} opacity-70 shrink-0`} />
              </div>
              {lastBackupFormatted && (
                <span className="text-[7.5px] min-[360px]:text-[8px] sm:text-[8.5px] font-medium text-white/80 tracking-tight leading-none truncate max-w-full select-none mt-0.5">
                  {lastBackupFormatted}
                </span>
              )}
            </div>

            {/* Ripristina (Redo) - a destra */}
            <button 
              onClick={onRedo} 
              disabled={!canRedo}
              className={`w-[26px] h-[26px] min-[360px]:w-7 min-[360px]:h-7 flex items-center justify-center rounded-full transition-all magi-press shrink-0 ${
                canRedo ? 'bg-white/15 hover:bg-white/25 active:bg-white/35 text-white shadow-xs' : 'opacity-25 cursor-not-allowed text-white'
              }`}
              title="Ripristina"
              aria-label="Ripristina operazione"
            >
              <Redo2 className="w-3 h-3 min-[360px]:w-3.5 min-[360px]:h-3.5" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* VERSIONE TABLET (md <= screen < lg): RIGA SINGOLA COMPATTA */}
        {/* ========================================================= */}
        <div className="hidden md:flex lg:hidden items-center justify-between w-full gap-2">
          {/* Gruppo Sinistra: Icona App, Navigazione, Ore Residue, Filtro Classi */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onNavigate('today')}
              className="w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-xs ring-1 ring-white/25 transition-transform active:scale-95"
              title="MagiClass - Torna a oggi"
              aria-label="MagiClass"
            >
              <AppIcon className="w-full h-full" />
            </button>

            <button 
              onClick={() => onNavigate('prev')} 
              className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-full transition-all magi-press shadow-xs shrink-0"
              title="Settimana precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Pulsante settimane compatto: 'quadr.' abbreviato in 'Q.' */}
            <button 
              onClick={() => onNavigate('today')}
              className="h-8 px-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-lg transition-all magi-press text-xs font-bold shadow-xs flex items-center gap-1 border border-white/15 shrink-0"
              title="Torna a oggi"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Sett. {weekCount || "-"}</span>
              <span className="text-[9px] opacity-75 font-black uppercase whitespace-nowrap">
                {getSemesterLabel(true)}
              </span>
            </button>

            <button 
              onClick={() => onNavigate('next')} 
              className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-full transition-all magi-press shadow-xs shrink-0"
              title="Settimana successiva"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button 
              onClick={onOpenRemainingHours}
              className="w-8 h-8 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-full transition-all magi-press shadow-xs flex items-center justify-center font-bold text-sm shrink-0"
              title="Ore residue"
            >
              h
            </button>

            <button 
              onClick={onOpenClassFilter}
              className={`w-8 h-8 rounded-full transition-all magi-press shadow-xs flex items-center justify-center shrink-0 border ${
                focusClass 
                ? 'bg-white text-primary border-white scale-105 shadow-md font-bold' 
                : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
              }`}
              title="Filtra Classi"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {/* Gruppo Centro Tablet: Informazioni Temporali (Mese, Anno, Anno Scolastico) inserite tra i pulsanti */}
          <div className="flex-1 flex items-center justify-center min-w-0 px-1">
            <div 
              onClick={onOpenMonthPicker}
              className="flex flex-col items-center justify-center cursor-pointer hover:bg-white/15 active:bg-white/25 rounded-lg py-0.5 px-2.5 transition-all magi-press max-w-full"
              title="Seleziona Mese e Anno Scolastico"
            >
              <div className="flex items-center gap-1.5 md:gap-2">
                <div className="flex items-baseline gap-1.5 shrink-0">
                  <span className={`font-black tracking-tight ${monthStyles.text} text-base md:text-lg drop-shadow-xs capitalize`}>
                    {monthName}
                  </span>
                  <span className={`text-sm md:text-base font-light opacity-80 ${monthStyles.text}`}>
                    {yearNum}
                  </span>
                </div>
                {activeSchoolYear && (
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider bg-white/20 text-white px-2 py-0.5 rounded-full border border-white/20 shadow-xs whitespace-nowrap shrink-0">
                    A.S. {activeSchoolYear.label}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 ${monthStyles.text} opacity-70 shrink-0`} />
              </div>
              {lastBackupFormatted && (
                <span className="text-[8.5px] md:text-[9.5px] font-medium text-white/80 tracking-tight leading-none mt-0.5 select-none truncate">
                  {lastBackupFormatted}
                </span>
              )}
            </div>
          </div>

          {/* Gruppo Destra: Ricerca, Impostazioni, Annulla, Ripristina */}
          <div className="flex items-center gap-1.5 shrink-0">

            <button 
              onClick={onOpenSearch}
              className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-full transition-all magi-press shadow-xs shrink-0"
              title="Cerca Compiti"
            >
              <Search className="w-4 h-4" />
            </button>

            <button 
              onClick={onOpenSettings}
              className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-full transition-all magi-press shadow-xs shrink-0"
              title="Impostazioni"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button 
              onClick={onUndo} 
              disabled={!canUndo}
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-all magi-press shrink-0 ${
                canUndo ? 'bg-white/10 hover:bg-white/20 active:bg-white/30 text-white shadow-xs' : 'opacity-25 cursor-not-allowed text-white'
              }`}
              title="Annulla"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            <button 
              onClick={onRedo} 
              disabled={!canRedo}
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-all magi-press shrink-0 ${
                canRedo ? 'bg-white/10 hover:bg-white/20 active:bg-white/30 text-white shadow-xs' : 'opacity-25 cursor-not-allowed text-white'
              }`}
              title="Ripristina"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            {onQuickBackup && (
              <button
                onClick={onQuickBackup}
                disabled={isQuickBackupSaving}
                className={`w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-full transition-all magi-press shadow-xs shrink-0 ${
                  isQuickBackupSaving ? 'opacity-60 animate-pulse cursor-wait' : ''
                }`}
                title="Salva backup"
                aria-label="Salva backup"
              >
                <Save className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* VERSIONE PC (>= lg): LAYOUT ORIGINALE INTATTO AL 100%       */}
        {/* ========================================================= */}
        <div className="hidden lg:flex items-center justify-between w-full">
          <div className="flex items-center gap-2 z-10 flex-none shrink-0">
            <button
              onClick={() => onNavigate('today')}
              className="w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-sm ring-1 ring-white/25 transition-transform hover:scale-105 active:scale-95"
              title="MagiClass - Torna a oggi"
              aria-label="MagiClass"
            >
              <AppIcon className="w-full h-full" />
            </button>
            <button onClick={() => onNavigate('prev')} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors magi-press shadow-sm" title="Settimana precedente">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              onClick={() => onNavigate('today')}
              className="flex px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all magi-press text-sm font-bold shadow-sm flex-col items-center leading-none gap-0.5 border border-white/10"
              title="Torna a oggi"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                Sett. {weekCount || "-"}
              </div>
              <span className="text-[9px] opacity-70 uppercase tracking-wider">{getSemesterLabel()}</span>
            </button>
            <button onClick={() => onNavigate('next')} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors magi-press shadow-sm" title="Settimana successiva">
              <ChevronRight className="w-6 h-6" />
            </button>
            <button 
              onClick={onOpenRemainingHours}
              className="ml-1 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all magi-press shadow-sm flex items-center justify-center font-bold text-base w-10 h-10"
              title="Ore residue"
            >
              h
            </button>
            <button 
              onClick={onOpenClassFilter}
              className={`ml-1 p-2 rounded-full transition-all magi-press shadow-sm flex items-center justify-center w-10 h-10 border ${
                focusClass 
                ? 'bg-white text-primary border-white scale-110 shadow-lg' 
                : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
              }`}
              title="Filtra Classi"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center z-0 px-2 min-w-0">
            <div 
              onClick={onOpenMonthPicker}
              className="flex flex-col items-center justify-center max-w-full cursor-pointer hover:bg-white/10 rounded-xl px-4 py-1 transition-all group magi-press"
            >
              <div className="flex items-center gap-2">
                <div className="flex items-baseline gap-2 overflow-hidden">
                  <h1 className={`text-4xl font-black tracking-tight ${monthStyles.text} opacity-100 drop-shadow-md`}>{monthName}</h1>
                  <span className={`text-2xl font-light opacity-80 ${monthStyles.text}`}>{yearNum}</span>
                </div>
                {activeSchoolYear && (
                  <span className="text-[11px] font-black uppercase tracking-wider bg-white/20 hover:bg-white/30 text-white px-2.5 py-0.5 rounded-full border border-white/20 shadow-xs ml-1 transition-all">
                    A.S. {activeSchoolYear.label}
                  </span>
                )}
                <ChevronDown className={`w-5 h-5 ${monthStyles.text} opacity-0 group-hover:opacity-80 transition-opacity`} />
              </div>
              {lastBackupFormatted && (
                <span className="text-[11px] font-medium text-white/80 tracking-tight leading-none mt-1 select-none drop-shadow-xs">
                  {lastBackupFormatted}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 z-10 flex-none ml-auto shrink-0">
            <button 
              onClick={onOpenSearch}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all magi-press shadow-sm"
              title="Cerca Compiti"
            >
              <Search className="w-6 h-6" />
            </button>
            <button 
              onClick={onOpenSettings}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all magi-press shadow-sm"
              title="Impostazioni"
            >
              <Settings className="w-6 h-6" />
            </button>
            <button 
              onClick={onUndo} 
              disabled={!canUndo}
              className={`p-2 rounded-full transition-all magi-press ${canUndo ? 'bg-white/10 hover:bg-white/20 text-white shadow-sm' : 'opacity-30 cursor-not-allowed text-white'}`}
              title="Annulla"
            >
              <Undo2 className="w-6 h-6" />
            </button>
            <button 
              onClick={onRedo} 
              disabled={!canRedo}
              className={`p-2 rounded-full transition-all magi-press ${canRedo ? 'bg-white/10 hover:bg-white/20 text-white shadow-sm' : 'opacity-30 cursor-not-allowed text-white'}`}
              title="Ripristina"
            >
              <Redo2 className="w-6 h-6" />
            </button>
            {onQuickBackup && (
              <button
                onClick={onQuickBackup}
                disabled={isQuickBackupSaving}
                className={`p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all magi-press shadow-sm ${
                  isQuickBackupSaving ? 'opacity-60 animate-pulse cursor-wait' : ''
                }`}
                title="Salva backup"
                aria-label="Salva backup"
              >
                <Save className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div 
        className={`${isMobileWeekView ? 'flex' : 'hidden md:flex'} flex-col flex-1 min-h-0 overflow-hidden touch-pan-y w-full`}
        onTouchStart={(e) => handleTouchStart(e, "", "")} 
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
            transform: `translateX(${swipeOffset}px)`,
            transition: isSwiping || !isAnimating ? 'none' : 'transform 0.4s cubic-bezier(0.2, 1, 0.3, 1)',
        }}
      >
        <div className="flex border-b border-slate-200 bg-white shrink-0 h-7.5 sm:h-8 md:h-9 lg:h-10">
          <div className="w-8 sm:w-9 md:w-11 lg:w-14 flex-none border-r border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 relative px-0.5 gap-0.5">
             {schedule.length === 0 && (
                 <button 
                    onClick={onCopyPreviousWeek}
                    className="p-0.5 sm:p-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-all magi-press shadow-xs animate-pulse flex items-center border border-blue-200"
                    title="Copia da settimana precedente"
                 >
                    <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                 </button>
             )}
             <button 
                onClick={onOpenRecessModal}
                className="p-0.5 sm:p-1 text-amber-500 hover:text-amber-600 hover:bg-amber-100 rounded transition-all magi-press"
                title="Configura Ricreazione"
             >
                 <Coffee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
             </button>
          </div>
          
          {weekDates.map((date, index) => {
             const isToday = date.toDateString() === new Date().toDateString();
             const isPast = isDatePast(date);
             const isFuture = !isToday && !isPast;
             const dateNum = date.getDate();
             const dayName = activeDays[index];
             const specialDay = getSpecialDay(date);
             const dateStr = getLocalDateKey(date);
             const isProvisional = isDateInProvisionalPeriod(dateStr, provisionalPeriods || []);

             let headerBg = isToday ? 'bg-primary/5' : 'bg-white';
             let headerBorder = isToday ? 'border-l-2 border-r-2 border-primary z-10' : '';
             let headerTextColor = isToday ? 'text-primary' : 'text-slate-500';
             let numBg = isToday 
               ? (isProvisional ? 'bg-yellow-100 text-primary ring-2 ring-primary shadow-xs' : 'bg-primary text-white shadow-xs')
               : (isProvisional ? 'text-slate-700 group-hover:scale-105 transition-transform bg-yellow-100' : 'text-slate-700 group-hover:scale-105 transition-transform bg-slate-100');
             let iconElement = null;
             let labelText = null;

             if (specialDay) {
                  const config = getSpecialDayConfig(specialDay.type);
                  headerBg = config.bg;
                  headerTextColor = config.textColor;
                  iconElement = config.icon;
                  labelText = config.text;
                  numBg = isProvisional 
                    ? 'bg-yellow-100/90 text-current border border-current shadow-xs' 
                    : 'bg-white/50 text-current border border-current shadow-xs';
             }
             
             return (
                <div key={index} className="flex-1 min-w-0 flex flex-col h-full">
                    <div className={`w-full h-full flex items-center justify-center gap-0.5 sm:gap-1.5 px-0.5 sm:px-1 border-r border-slate-200 cursor-pointer transition-colors relative overflow-hidden group flex-1 min-w-0
                        ${headerBg} ${headerBorder} hover:bg-slate-50
                        ${isPast ? 'opacity-50 grayscale' : ''}
                        ${isFuture ? 'opacity-85 saturate-[0.5]' : ''}
                    `}
                    onClick={() => {
                        if (window.innerWidth < 768) handleMobileWeekHeaderClick(index); 
                        else onDayHeaderClick(date); 
                    }}
                    >
                        {iconElement && <div className="scale-75 shrink-0">{iconElement}</div>}
                        <span className={`text-[9px] sm:text-[10px] md:text-xs font-bold uppercase tracking-wider ${headerTextColor} shrink-0`}>
                            {dayName.substring(0, 3)}
                        </span>
                        <div 
                            className={`w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6 flex items-center justify-center rounded ${numBg} transition-transform group-active:scale-90 shrink-0`}
                            title={isProvisional ? "Orario provvisorio" : undefined}
                        >
                            <span className="text-[11px] sm:text-xs md:text-sm font-black leading-none">{dateNum}</span>
                        </div>
                        {labelText && (
                             <span className={`hidden sm:inline text-[7.5px] sm:text-[8px] font-bold uppercase tracking-tight ${headerTextColor} truncate max-w-[45px] lg:max-w-[70px] shrink-0`}>
                                 {labelText}
                             </span>
                        )}
                    </div>
                    {isToday && <div className="hidden md:block absolute left-0 top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none h-[200vh]" />}
                    {isToday && <div className="hidden md:block absolute right-0 top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none h-[200vh]" />}
               </div>
             );
          })}
        </div>

        <div
          ref={desktopGridScrollRef}
          onScroll={onScrollPositionChange ? (e) => onScrollPositionChange('scheduleDesktopGrid', e.currentTarget.scrollTop) : undefined}
          className="flex-1 min-h-0 overflow-hidden flex flex-col bg-slate-50/30"
        >
          {(() => {
             const anyRowHasLessons = hoursArray.some(h => 
                 weekDates.some((date, dayIdx) => {
                     const l = getLesson(activeDays[dayIdx], h, date);
                     return l && l.className !== 'BUCO';
                 })
             );

             return hoursArray.map((hour) => {
               const recess = recesses.find(r => r.afterHour === hour);
               const isRecessTime = !!recess;
               const isAssociatedToNextHour = recess?.associatedHour === hour + 1;
               const isAssociatedToCurrentHour = recess?.associatedHour === hour;

               const recessAbove = recesses.find(r => r.afterHour === hour - 1);
               const isAssociatedWithRecessAbove = recessAbove?.associatedHour === hour;
               const recessHeightClass = 'h-4 sm:h-4.5 md:h-5';
               const recessTextSize = 'text-[7.5px] sm:text-[8px] md:text-[8px]';
               const rowHasLessons = weekDates.some((date, dayIdx) => {
                   const l = getLesson(activeDays[dayIdx], hour, date);
                   return l && l.className !== 'BUCO';
               });
               const rowHeightClass = anyRowHasLessons 
                   ? (rowHasLessons ? 'flex-1 min-h-[60px] md:min-h-[72px]' : 'h-6 sm:h-7 md:h-7.5 shrink-0') 
                   : 'flex-1 min-h-0';

               return (
                 <React.Fragment key={hour}>
                   <div className={`flex ${rowHeightClass} min-h-0 border-b border-slate-200 transition-all duration-300`}>
                   {(() => {
                     const weekTimeInfo = getTimeSlotDisplay(hour, effectiveWeekTimeSlots);
                     return rowHasLessons ? (
                       <div 
                          className={`w-8 sm:w-9 md:w-11 lg:w-14 flex-none border-r border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-0.5 shrink-0 cursor-pointer hover:bg-blue-50 transition-colors flex-none magi-press overflow-hidden ${
                            isAssociatedWithRecessAbove ? 'border-t-0' : ''
                          }`}
                          onClick={() => onTimeSlotClick(hour)}
                          title={`Modifica orario ${hour}° ora${weekTimeInfo.recess ? ` (include ricreazione di ${weekTimeInfo.recess.duration} min)` : ''}`}
                       >
                         <span className="text-sm sm:text-base md:text-xl font-black text-slate-300 leading-tight">{hour}°</span>
                         {weekTimeInfo.hasAssociatedRecess ? (
                           <div className="flex flex-col items-center text-[7px] sm:text-[7.5px] md:text-[8px] text-slate-400 font-bold uppercase tracking-tighter leading-none mt-0.5 md:mt-1 tabular-nums">
                             <span className="whitespace-nowrap font-bold text-slate-500">{weekTimeInfo.recessStart}</span>
                             <span className="text-[6px] sm:text-[6.5px] md:text-[7px] font-extrabold text-amber-600 my-0.5 tracking-tight">{weekTimeInfo.recessDuration}</span>
                             <span className="whitespace-nowrap font-bold text-slate-500">{weekTimeInfo.effectiveEnd}</span>
                           </div>
                         ) : (
                           <div className="flex flex-col items-center text-[7px] sm:text-[7.5px] md:text-[8px] text-slate-400 font-bold uppercase tracking-tighter leading-none mt-0.5 md:mt-1 tabular-nums">
                             <span className="whitespace-nowrap">{weekTimeInfo.nominalStart}</span>
                             <div className="h-px w-2.5 sm:w-3 bg-slate-200 my-0.5" />
                             <span className="whitespace-nowrap">{weekTimeInfo.nominalEnd}</span>
                           </div>
                         )}
                       </div>
                     ) : (
                       <div 
                          className={`w-8 sm:w-9 md:w-11 lg:w-14 flex-none border-r border-slate-200 bg-slate-50 flex items-center justify-center px-0.5 py-0.5 shrink-0 cursor-pointer hover:bg-blue-50 transition-colors flex-none magi-press overflow-hidden ${
                            isAssociatedWithRecessAbove ? 'border-t-0' : ''
                          }`}
                          onClick={() => onTimeSlotClick(hour)}
                          title={`Modifica orario ${hour}° ora${weekTimeInfo.recess ? ` (include ricreazione di ${weekTimeInfo.recess.duration} min)` : ''}`}
                       >
                         <div className="flex items-center justify-center gap-0.5 sm:gap-1 w-full h-full">
                           <span className="text-[10px] sm:text-xs md:text-sm font-black text-slate-300 leading-none shrink-0">{hour}°</span>
                           {weekTimeInfo.hasAssociatedRecess ? (
                             <div className="flex flex-col items-center justify-center text-[5.5px] sm:text-[6px] md:text-[6.5px] text-slate-400 font-bold uppercase tracking-tighter leading-none shrink-0 tabular-nums">
                               <span className="whitespace-nowrap font-bold text-slate-500">{weekTimeInfo.recessStart}</span>
                               <span className="text-[5.5px] sm:text-[6px] font-extrabold text-amber-600 tracking-tight leading-none my-0.5">{weekTimeInfo.recessDuration}</span>
                               <span className="whitespace-nowrap font-bold text-slate-500">{weekTimeInfo.effectiveEnd}</span>
                             </div>
                           ) : (
                             <div className="flex flex-col items-center justify-center text-[6.5px] sm:text-[7px] md:text-[7.5px] text-slate-400 font-bold uppercase tracking-tighter leading-tight shrink-0 tabular-nums">
                               <span className="whitespace-nowrap">{weekTimeInfo.nominalStart}</span>
                               <span className="whitespace-nowrap">{weekTimeInfo.nominalEnd}</span>
                             </div>
                           )}
                         </div>
                       </div>
                     );
                   })()}

                   {weekDates.map((date, dayIndex) => {
                     const dayEnum = activeDays[dayIndex];
                     const lesson = getLesson(dayEnum, hour, date);
                     const dateStr = getLocalDateKey(date);
                     
                     const rawNote = lesson ? findNoteForLesson(lesson.id, dateStr, lesson) : undefined;
                     const notes = lesson ? getNotes(lesson.id, dateStr, lesson) : null;
                     
                     const isAssembly = rawNote?.type === 'assembly';
                     const isTrip = rawNote?.type === 'trip';
                     const isSkipped = rawNote?.type === 'skipped_lesson';
                     const isPractical = rawNote?.type === 'practical_exam';
                     const isOral = rawNote?.type === 'oral_exam';
                     const isWritten = rawNote?.type === 'written_exam';

                     const specialDay = getSpecialDay(date);
                     const isToday = date.toDateString() === new Date().toDateString();
                     const isPast = isDatePast(date);
                     const isFuture = !isToday && !isPast;
                     
                     if (specialDay) {
                         const { bg } = getSpecialDayConfig(specialDay.type);
                         return (
                             <div 
                                key={`${dayIndex}-${hour}`} 
                                className={`flex-1 min-w-0 border-r border-slate-200 relative overflow-hidden
                                  ${bg}
                                  ${isToday ? '!border-x-2 !border-primary' : ''} 
                                  ${isPast ? 'opacity-50 grayscale' : ''}
                                  ${isFuture ? 'opacity-85 saturate-[0.5]' : ''}
                                  cursor-pointer
                                `}
                                onClick={() => onDayHeaderClick(date)}
                             >
                                 <div className="absolute inset-0 opacity-10 pointer-events-none" 
                                      style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 10px)' }}>
                                 </div>
                             </div>
                         );
                     }

                     const lessonColorStyle = lesson ? getLessonColorStyles(lesson) : 'bg-slate-100';
                     const specialEventHatch = getSpecialEventHatchStyle(lessonColorStyle);
                     const isBeingDragged = lesson && draggingId === lesson.id && draggingSourceDate === dateStr;
                     const isDragTarget = dragOverSlot && dragOverSlot.day === dayEnum && dragOverSlot.hour === hour && dragOverSlot.dateStr === dateStr;
                     const isHighlighted = (lesson && lesson.id === highlightedLessonId) || (focusClass && lesson && lesson.className === focusClass);
                     const isDimmed = focusClass && lesson && lesson.className !== focusClass;
                     const hasToDo = rawNote?.toDo && rawNote.toDo.trim().length > 0;
                     const subjectName = lesson ? getLessonSubjectName(lesson) : '';

                     return (
                       <div 
                         key={`${dayIndex}-${hour}`} 
                         className={`flex-1 min-w-0 border-r border-slate-200 relative group transition-colors flex flex-col
                            ${isToday ? '!border-x-2 !border-primary z-10' : ''}
                            ${isPast ? 'opacity-50 grayscale' : ''}
                            ${isFuture ? 'opacity-85 saturate-[0.5]' : ''}
                            ${!lesson ? 'hover:bg-slate-100' : ''}
                            ${isDragTarget ? 'bg-primary/5 ring-2 ring-inset ring-primary z-30' : ''}
                         `}
                         onClick={() => lesson ? onLessonClick(lesson, dateStr) : onEmptySlotClick(dayEnum, hour, dateStr)}
                         data-day={dayEnum}
                         data-hour={hour}
                         data-date={dateStr}
                         onDragOver={(e) => handleDragOver(e, dayEnum, hour, dateStr)}
                         onDrop={(e) => handleDrop(e, dayEnum, hour, dateStr)}
                       >
                         {lesson ? (
                           <div 
                             className={`w-full h-full flex-1 p-1 flex flex-col ${lessonColorStyle} transition-all relative overflow-hidden magi-press
                                ${isBeingDragged ? 'opacity-40 scale-95 border-2 border-dashed border-slate-500' : ''}
                                ${isHighlighted ? 'ring-inset ring-4 ring-primary/20 z-10 shadow-lg scale-[1.01]' : ''}
                                ${isDimmed ? 'opacity-20 grayscale brightness-75 scale-95' : ''}
                             `}
                             draggable="false"
                             onTouchStart={(e) => handleTouchStart(e, lesson.id, dateStr)}
                           >
                             <div className={`flex flex-col ${subjectName ? '-mt-1' : 'pt-0.5'} shrink-0 relative ${isMobileWeekView ? 'portrait:gap-0.5' : 'pr-6'}`}>
                                 {subjectName && (
                                     <span 
                                         className="text-[9px] sm:text-[10px] md:text-[11px] font-bold tracking-wider uppercase opacity-75 truncate leading-tight select-none -mt-px"
                                         title={subjectName}
                                     >
                                         {subjectName}
                                     </span>
                                 )}
                                 <div className={`flex items-center gap-1.5 flex-nowrap ${subjectName ? '-mt-2' : ''} ${isMobileWeekView ? 'portrait:flex-col portrait:items-start portrait:gap-0.5' : ''}`}>
                                     <span className={`${isMobileWeekView ? 'text-lg portrait:text-base portrait:leading-tight' : 'text-xl md:text-lg lg:text-2xl'} font-black font-sans tracking-tight leading-none truncate shrink-0`}>
                                         {lesson.className}
                                     </span>
                                     {isDisposizioneLesson(lesson) && lesson.repeatMode && lesson.repeatMode !== 'none' && (
                                       <span 
                                         className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-stone-200/80 text-stone-700 shrink-0 shadow-xs" 
                                         title={lesson.repeatMode === 'weekly' ? 'Ripetizione: Ogni settimana' : 'Ripetizione: A settimane alterne'}
                                       >
                                         <Repeat className="w-2.5 h-2.5 text-stone-600" />
                                         <span className="hidden sm:inline">{lesson.repeatMode === 'weekly' ? 'Sett.' : 'Alt.'}</span>
                                       </span>
                                     )}
                                     
                                     {!isMobileWeekView && (
                                         <div className="flex items-center gap-1 min-w-0 flex-1">
                                             {renderSyncBadges(lesson.id, dateStr, false, false, lesson)}
                                         </div>
                                     )}
                                     
                                     {isMobileWeekView && (
                                         <div className={`${isMobileWeekView ? 'ml-auto mr-1 portrait:ml-0 portrait:mr-0 portrait:my-0.5' : ''}`}>
                                             {renderSyncBadges(lesson.id, dateStr, true, isMobileWeekView, lesson)}
                                         </div>
                                     )}
                                 </div>
                                 
                                 <div className="absolute right-[-4px] top-[-4px] flex items-center z-20">
                                    {hasToDo && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const textToCopy = rawNote.toDo.split('\n')
                                                    .map(line => line.replace(/\{[VXO]\}/g, '').trim())
                                                    .filter(l => l.length > 0)
                                                    .join('\n');
                                                navigator.clipboard.writeText(textToCopy);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors magi-press"
                                            title="Copia contenuti 'Fare'"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    )}
                                    <div 
                                        className="p-1.5 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 hidden md:block transition-colors"
                                        draggable="true"
                                        onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, lesson.id, dateStr); }}
                                        onDragEnd={handleDragEnd}
                                        onClick={(e) => e.stopPropagation()} 
                                        title="Trascina per spostare"
                                    >
                                        <GripHorizontal className="w-4 h-4" />
                                    </div>
                                 </div>
                             </div>
                             <div className="flex-1 min-h-0 relative">
                                {isAssembly ? (
                                    <div className={`w-full h-full flex flex-col items-center justify-center special-event-hatch ${specialEventHatch.hatchClass} rounded-lg border-2 ${specialEventHatch.borderClass} p-2 transition-all animate-magi-fade`}>
                                        <div className="flex items-center justify-center scale-75 group-hover:scale-100 transition-transform">
                                            <Users className={`w-6 h-6 sm:w-8 sm:h-8 ${specialEventHatch.iconClass} special-event-label mb-1 shrink-0`} />
                                        </div>
                                        <span className={`text-[9px] sm:text-[10px] font-black ${specialEventHatch.textClass} special-event-label uppercase text-center leading-tight whitespace-nowrap`}>
                                            ASSEMBLEA<br/>DI CLASSE
                                        </span>
                                    </div>
                                ) : isTrip ? (
                                    <div className={`w-full h-full flex flex-col items-center justify-center special-event-hatch ${specialEventHatch.hatchClass} rounded-lg border-2 ${specialEventHatch.borderClass} p-2 transition-all animate-magi-fade`}>
                                        <div className="flex items-center justify-center scale-75 group-hover:scale-100 transition-transform">
                                            <MapPin className={`w-6 h-6 sm:w-8 sm:h-8 ${specialEventHatch.iconClass} special-event-label mb-1 shrink-0`} />
                                        </div>
                                        <span className={`text-[9px] sm:text-[10px] font-black ${specialEventHatch.textClass} special-event-label uppercase text-center leading-tight whitespace-nowrap`}>
                                            VISITA<br/>GUIDATA
                                        </span>
                                    </div>
                                ) : isSkipped ? (
                                    <div className={`w-full h-full flex flex-col items-center justify-center special-event-hatch ${specialEventHatch.hatchClass} rounded-lg border-2 ${specialEventHatch.borderClass} p-2 transition-all animate-magi-fade`}>
                                        <Ban className={`w-6 h-6 sm:w-8 sm:h-8 ${specialEventHatch.iconClass} special-event-label mb-1`} />
                                        <span className={`text-[9px] sm:text-[10px] font-black ${specialEventHatch.textClass} special-event-label uppercase text-center leading-tight`}>
                                            LEZIONE<br/>SALTATA
                                        </span>
                                    </div>
                                ) : isPractical ? (
                                    <div className={`w-full h-full flex flex-col items-center justify-center special-event-hatch ${specialEventHatch.hatchClass} rounded-lg border-2 ${specialEventHatch.borderClass} p-2 transition-all animate-magi-fade`}>
                                        <span className={`text-[9px] sm:text-[10px] font-black ${specialEventHatch.textClass} special-event-label uppercase text-center leading-tight`}>
                                            COMPITO<br/>PRATICO
                                        </span>
                                    </div>
                                ) : isOral ? (
                                    <div className={`w-full h-full flex flex-col items-center justify-center special-event-hatch ${specialEventHatch.hatchClass} rounded-lg border-2 ${specialEventHatch.borderClass} p-2 transition-all animate-magi-fade`}>
                                        <span className={`text-[9px] sm:text-[10px] font-black ${specialEventHatch.textClass} special-event-label uppercase text-center leading-tight`}>
                                            COMPITO DI<br/>TEORIA
                                        </span>
                                    </div>
                                ) : isWritten ? (
                                    <div className={`w-full h-full flex flex-col items-center justify-center special-event-hatch ${specialEventHatch.hatchClass} rounded-lg border-2 ${specialEventHatch.borderClass} p-2 transition-all animate-magi-fade`}>
                                        <span className={`text-[9px] sm:text-[10px] font-black ${specialEventHatch.textClass} special-event-label uppercase text-center leading-tight`}>
                                            COMPITO<br/>SCRITTO
                                        </span>
                                    </div>
                                ) : (
                                    <AutoScrollWrapper>
                                        <div className="flex flex-col gap-0.5 w-full pt-1">
                                            {renderNoteGroups(notes || [], lesson.id, dateStr, isMobileWeekView)}
                                        </div>
                                    </AutoScrollWrapper>
                                )}
                             </div>
                           </div>
                         ) : (
                           <div className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <div className={`${rowHasLessons ? 'w-8 h-8' : 'w-5 h-5 sm:w-6 sm:h-6'} rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shadow-xs magi-press`}>
                                <Plus className={`${rowHasLessons ? 'w-5 h-5' : 'w-3.5 h-3.5'}`} />
                             </div>
                           </div>
                         )}
                       </div>
                     );
                   })}
                 </div>
                 {isRecessTime && (
                     <div className={`flex shrink-0 ${recessHeightClass} items-stretch relative overflow-hidden`}>
                         {/* Cella colonna laterale ore della ricreazione */}
                         <div className={`w-8 sm:w-9 md:w-11 lg:w-14 flex-none border-r border-slate-200 bg-slate-50 flex items-center justify-center relative transition-colors ${
                             isAssociatedToNextHour 
                               ? 'border-b-0 border-t-2 border-slate-300 shadow-xs' 
                               : isAssociatedToCurrentHour
                                 ? 'border-t-0 border-b-2 border-slate-300'
                                 : 'border-b border-slate-200'
                         }`}>
                             {isAssociatedToNextHour && (
                                 <div className="flex items-center justify-center text-amber-500" title={`Ricreazione associata alla ${hour + 1}ª ora`}>
                                     <Coffee className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                 </div>
                             )}
                             {isAssociatedToCurrentHour && (
                                 <div className="flex items-center justify-center text-amber-500" title={`Ricreazione associata alla ${hour}ª ora`}>
                                     <Coffee className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                 </div>
                             )}
                         </div>

                         {/* Banner Ricreazione */}
                         <div className="flex-1 relative flex items-center justify-center bg-slate-50 border-b border-slate-200 overflow-hidden">
                             <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none" 
                                  style={{ backgroundImage: 'repeating-linear-gradient(45deg, #cbd5e1 0, #cbd5e1 1px, transparent 0, transparent 10px)' }}>
                             </div>
                             <span className={`relative bg-slate-50 px-1.5 sm:px-2 font-bold text-slate-400 uppercase tracking-wider md:tracking-widest z-10 leading-none ${recessTextSize}`}>
                                RICREAZIONE
                             </span>
                         </div>
                     </div>
                 )}
               </React.Fragment>
             );
           });
          })()}
        </div>
      </div>
       <div 
            className={`${isMobileWeekView ? 'hidden' : 'md:hidden flex'} flex-1 overflow-hidden flex-col relative touch-pan-y`}
            onTouchStart={(e) => handleTouchStart(e, "", "")} 
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div className="flex border-b border-slate-200 bg-white shrink-0 z-10 relative">
                {activeDays.map((dayName, idx) => (
                    <button
                        key={dayName}
                        onClick={() => setActiveMobileTab(idx)}
                        className={`flex-1 py-1.5 sm:py-2 text-center text-xs font-bold transition-all relative magi-press
                            ${idx === activeMobileTab ? 'text-primary bg-primary/5' : 'text-slate-500 hover:bg-slate-50'}
                        `}
                    >
                        {dayName.substring(0, 3)}
                        {idx === activeMobileTab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-magi-fade" />}
                    </button>
                ))}
            </div>
            <div className="flex-1 w-full relative overflow-hidden">
                <div 
                    className="flex h-full"
                    style={{ 
                        width: '300%',
                        marginLeft: '-100%', 
                        transform: `translateX(${swipeOffset}px)`,
                        transition: isSwiping || !isAnimating ? 'none' : 'transform 0.4s cubic-bezier(0.2, 1, 0.3, 1)',
                    }}
                >
                    <div className="w-1/3 h-full flex-shrink-0">
                        {renderMobileDayContent(mobilePanels.prev.idx, mobilePanels.prev.date, false)}
                    </div>
                    <div className="w-1/3 h-full flex-shrink-0 relative shadow-xl z-10">
                         {renderMobileDayContent(mobilePanels.curr.idx, mobilePanels.curr.date, true)}
                    </div>
                    <div className="w-1/3 h-full flex-shrink-0">
                        {renderMobileDayContent(mobilePanels.next.idx, mobilePanels.next.date, false)}
                    </div>
                </div>
            </div>
       </div>
    </div>
  );
};

export default ScheduleView;
