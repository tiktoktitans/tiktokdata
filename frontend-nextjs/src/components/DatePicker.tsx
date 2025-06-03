"use client";
// Modern DatePicker Component - v2.0
import React, { useState, useRef, useEffect } from 'react';

interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
}

export default function DatePicker({ value, onChange, placeholder = "Select date..." }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value || new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Previous month's trailing days
    const prevMonth = new Date(year, month - 1, 0);
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonth.getDate() - i,
        isCurrentMonth: false,
        date: new Date(year, month - 1, prevMonth.getDate() - i)
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        day,
        isCurrentMonth: true,
        date: new Date(year, month, day)
      });
    }

    // Next month's leading days
    const totalCells = Math.ceil(days.length / 7) * 7;
    let nextMonthDay = 1;
    for (let i = days.length; i < totalCells; i++) {
      days.push({
        day: nextMonthDay,
        isCurrentMonth: false,
        date: new Date(year, month + 1, nextMonthDay)
      });
      nextMonthDay++;
    }

    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newMonth;
    });
  };

  const selectDate = (date: Date) => {
    onChange(date);
    setIsOpen(false);
  };

  const clearDate = () => {
    onChange(null);
  };

  const isSelected = (date: Date) => {
    if (!value) return false;
    return date.toDateString() === value.toDateString();
  };

  const isToday = (date: Date) => {
    return date.toDateString() === new Date().toDateString();
  };

  const days = getDaysInMonth(currentMonth);
  const monthYear = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div ref={containerRef} className="relative">
      {/* Modern Input Field */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="group relative w-full flex items-center justify-between px-4 py-3 bg-gray-800/70 backdrop-blur-sm border border-gray-600/50 rounded-xl text-white transition-all duration-200 hover:bg-gray-700/70 hover:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors duration-200">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-left">
              <div className="text-sm font-medium">
                {value ? formatDate(value) : placeholder}
              </div>
              {value && (
                <div className="text-xs text-gray-400">
                  {value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {value && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearDate();
                }}
                className="p-1 hover:bg-red-500/20 rounded-md transition-colors duration-200 text-red-400 hover:text-red-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <svg 
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Animated dropdown indicator */}
        {isOpen && (
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 -z-10 blur-sm"></div>
        )}
      </div>

      {/* Modern Date Picker Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-3 z-50 w-80 bg-white/95 backdrop-blur-lg border border-gray-200/50 rounded-2xl shadow-2xl shadow-black/10 overflow-hidden">
          {/* Glassmorphism overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-white/50 to-white/30 backdrop-blur-xl"></div>
          
          <div className="relative p-6">
            {/* Modern Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Select Date</h3>
                  <p className="text-sm text-gray-500">Choose a date from the calendar</p>
                </div>
              </div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6 px-2">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900">{monthYear}</h3>
                <div className="w-16 h-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mx-auto mt-1"></div>
              </div>
              
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <div key={index} className="text-center text-xs font-bold text-gray-500 py-3 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((dayObj, index) => (
                <button
                  key={index}
                  onClick={() => selectDate(dayObj.date)}
                  className={`
                    relative h-10 text-sm font-medium rounded-xl transition-all duration-200 hover:scale-105 active:scale-95
                    ${dayObj.isCurrentMonth 
                      ? 'text-gray-900 hover:bg-gray-100' 
                      : 'text-gray-300 hover:bg-gray-50'
                    }
                    ${isSelected(dayObj.date) 
                      ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg hover:shadow-xl' 
                      : ''
                    }
                    ${isToday(dayObj.date) && !isSelected(dayObj.date)
                      ? 'bg-gray-900 text-white shadow-md'
                      : ''
                    }
                  `}
                >
                  {dayObj.day}
                  {isSelected(dayObj.date) && (
                    <div className="absolute inset-0 bg-white/20 rounded-xl"></div>
                  )}
                </button>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200/50">
              <button
                onClick={() => selectDate(new Date())}
                className="px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-xl transition-all duration-200"
              >
                Today
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}