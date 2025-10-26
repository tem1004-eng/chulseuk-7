import React, { useState, useMemo, FC, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const POSITIONS = ['목사', '부목사', '사모', '전도사', '장로', '권사', '집사', '성도', '청년', '학생', '주일학교', '기타'] as const;
const ATTENDANCE_STATUSES = ['출석', '결석'] as const;
const ALL_FILTER = '전체';
const LOCAL_STORAGE_KEY = 'churchAttendanceMembers';
const ITEMS_PER_PAGE = 15;

type Position = typeof POSITIONS[number];
type AttendanceStatus = typeof ATTENDANCE_STATUSES[number];

interface Member {
  id: number;
  name: string;
  position: Position;
  phone: string;
  attendance: Record<string, AttendanceStatus>; // date string 'YYYY-MM-DD' as key
}

// Helper to get today's date string
const getTodayString = () => new Date().toISOString().split('T')[0];

const unsortedMembers: Member[] = [];


const initialMembers = unsortedMembers.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

const generateYearlySundays = (year: number) => {
    const months: { month: number; sundays: Date[] }[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, sundays: [] }));
    const date = new Date(year, 0, 1);
    while (date.getFullYear() === year) {
        if (date.getDay() === 0) { // 0 is Sunday
            months[date.getMonth()].sundays.push(new Date(date));
        }
        date.setDate(date.getDate() + 1);
    }
    return months;
};

const YearlySundayCalendar: FC<{ year: number; selectedDate: string; onDateSelect: (date: string) => void; }> = ({ year, selectedDate, onDateSelect }) => {
    const calendarData = useMemo(() => generateYearlySundays(year), [year]);
    
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    
    const currentSundayDate = new Date();
    currentSundayDate.setDate(currentSundayDate.getDate() - currentSundayDate.getDay());
    const currentSundayString = currentSundayDate.toISOString().split('T')[0];
    const todayString = getTodayString();

    return (
        <div className="yearly-calendar-container">
            {calendarData.map(({ month, sundays }) => {
                const isCurrentMonth = year === currentYear && month === currentMonth;
                return (
                    <div key={month} className={`month-block ${isCurrentMonth ? 'current-month' : ''}`}>
                        <span className="month-title">{month}월</span>
                        <div className="week-buttons">
                            {sundays.map(day => {
                                const dateString = day.toISOString().split('T')[0];
                                const isCurrentWeek = dateString === currentSundayString;
                                const isToday = dateString === todayString;
                                return (
                                    <button
                                        key={dateString}
                                        className={`week-button ${selectedDate === dateString ? 'active' : ''} ${isCurrentWeek ? 'current-week' : ''} ${isToday ? 'today' : ''}`}
                                        onClick={() => onDateSelect(dateString)}
                                        aria-pressed={selectedDate === dateString}
                                    >
                                        {day.getDate()}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const AddMemberModal: FC<{ onSave: (data: { name: string; position: Position; phone: string }) => void; onCancel: () => void; }> = ({ onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [position, setPosition] = useState<Position>('성도');
    const [phone, setPhone] = useState('010-');

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
           if (event.key === 'Escape') {
              onCancel();
           }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onCancel]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && phone.trim()) {
            onSave({ name, position, phone });
        }
    };

    return (
        <div className="modal-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="add-modal-title">
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <h2 id="add-modal-title">새 교인 추가</h2>
                    <button className="btn-close" onClick={onCancel} aria-label="닫기">&times;</button>
                </header>
                <form onSubmit={handleSubmit} className="modal-body">
                    <div className="form-group">
                        <label htmlFor="add-name">이름</label>
                        <input type="text" id="add-name" name="name" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="add-position">직분</label>
                        <select id="add-position" name="position" value={position} onChange={e => setPosition(e.target.value as Position)}>
                            {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="add-phone">전화번호</label>
                        <input type="tel" id="add-phone" name="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" required />
                    </div>
                    <footer className="modal-footer">
                        <button type="button" className="btn" onClick={onCancel}>취소</button>
                        <button type="submit" className="btn btn-primary">저장</button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

const EditMemberModal: FC<{ member: Member; onSave: (member: Omit<Member, 'attendance'>) => void; onCancel: () => void; }> = ({ member, onSave, onCancel }) => {
    const [formData, setFormData] = useState({ name: member.name, position: member.position, phone: member.phone });

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
           if (event.key === 'Escape') {
              onCancel();
           }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onCancel]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value as any }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ id: member.id, ...formData });
    };

    return (
        <div className="modal-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <h2 id="edit-modal-title">교인 정보 수정</h2>
                    <button className="btn-close" onClick={onCancel} aria-label="닫기">&times;</button>
                </header>
                <form onSubmit={handleSubmit} className="modal-body">
                    <div className="form-group">
                        <label htmlFor="name">이름</label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="position">직분</label>
                        <select id="position" name="position" value={formData.position} onChange={handleChange}>
                            {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="phone">전화번호</label>
                        <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} required />
                    </div>
                    <footer className="modal-footer">
                        <button type="button" className="btn" onClick={onCancel}>취소</button>
                        <button type="submit" className="btn btn-primary">저장</button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

const MemberDetailModal: FC<{ member: Member; onClose: () => void }> = ({ member, onClose }) => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    const calendarData = useMemo(() => {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay();
        
        const days = [];
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(null);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    }, [year, month]);

    const stats = useMemo(() => {
        const yearAtt = Object.entries(member.attendance).filter(([date]) => date.startsWith(String(year)));
        const monthAtt = yearAtt.filter(([date]) => new Date(date).getMonth() === month);

        const totalYear = yearAtt.length;
        const presentYear = yearAtt.filter(([, status]) => status === '출석').length;
        const yearRate = totalYear > 0 ? ((presentYear / totalYear) * 100).toFixed(0) : 0;

        const totalMonth = monthAtt.length;
        const presentMonth = monthAtt.filter(([, status]) => status === '출석').length;
        const monthRate = totalMonth > 0 ? ((presentMonth / totalMonth) * 100).toFixed(0) : 0;

        return { presentMonth, totalMonth, monthRate, presentYear, totalYear, yearRate };
    }, [member.attendance, year, month]);

    return (
        <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="detail-modal-title">
            <div className="modal-content modal-content-large" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <h2 id="detail-modal-title">교인 상세 정보</h2>
                    <button className="btn-close" onClick={onClose} aria-label="닫기">&times;</button>
                </header>
                <div className="modal-body">
                    <div className="member-detail-header">
                        <h3>{member.name} <span className="position">({member.position})</span></h3>
                        <p className="phone">{member.phone}</p>
                    </div>
                    <div className="attendance-stats">
                        <h4>출석 현황</h4>
                        <div className="stats-grid">
                            <div><strong>금월 출석</strong><span>{stats.presentMonth} / {stats.totalMonth} 회 ({stats.monthRate}%)</span></div>
                            <div><strong>연간 출석</strong><span>{stats.presentYear} / {stats.totalYear} 회 ({stats.yearRate}%)</span></div>
                        </div>
                    </div>
                    <div className="calendar-container">
                        <h4>{year}년 {month + 1}월</h4>
                        <div className="calendar-header">
                            {['일', '월', '화', '수', '목', '금', '토'].map(day => <div key={day}>{day}</div>)}
                        </div>
                        <div className="calendar-grid">
                            {calendarData.map((day, index) => {
                                if (!day) return <div key={`empty-${index}`} className="calendar-day empty"></div>;
                                const dateStr = day.toISOString().split('T')[0];
                                const status = member.attendance[dateStr];
                                const isToday = dateStr === getTodayString();
                                return (
                                    <div key={dateStr} className={`calendar-day ${status ? (status === '출석' ? 'day-present' : 'day-absent') : ''} ${isToday ? 'day-today' : ''}`}>
                                        {day.getDate()}
                                    </div>
                                );
                            })}
                        </div>
                         <div className="calendar-legend">
                            <span className="legend-item"><span className="legend-color day-present"></span> 출석</span>
                            <span className="legend-item"><span className="legend-color day-absent"></span> 결석</span>
                            <span className="legend-item"><span className="legend-color day-today"></span> 오늘</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Pagination: FC<{ currentPage: number; totalPages: number; onPageChange: (page: number) => void; }> = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    const handlePrev = () => {
        if (currentPage > 1) onPageChange(currentPage - 1);
    };
    const handleNext = () => {
        if (currentPage < totalPages) onPageChange(currentPage + 1);
    };

    const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (
        <nav className="pagination-container" aria-label="페이지네이션">
            <button onClick={handlePrev} disabled={currentPage === 1} className="pagination-button">
                이전
            </button>
            {pageNumbers.map(number => (
                <button
                    key={number}
                    onClick={() => onPageChange(number)}
                    className={`pagination-button ${currentPage === number ? 'active' : ''}`}
                    aria-current={currentPage === number ? 'page' : undefined}
                >
                    {number}
                </button>
            ))}
            <button onClick={handleNext} disabled={currentPage === totalPages} className="pagination-button">
                다음
            </button>
        </nav>
    );
};


const validateImportedData = (data: any): { isValid: boolean; error: string | null; validatedMembers: Member[] | null } => {
    if (typeof data === 'undefined' || data === null) {
        return { isValid: false, error: '파일에 데이터가 없습니다.', validatedMembers: null };
    }
    if (!Array.isArray(data)) {
        return { isValid: false, error: '데이터 파일의 최상위 구조는 배열(Array)이어야 합니다.', validatedMembers: null };
    }

    const validatedMembers: Member[] = [];
    for (let i = 0; i < data.length; i++) {
        const member = data[i];
        if (typeof member !== 'object' || member === null) {
            return { isValid: false, error: `${i + 1}번째 항목이 올바른 객체(Object)가 아닙니다.`, validatedMembers: null };
        }
        
        if (typeof member.id !== 'number') return { isValid: false, error: `${i + 1}번째 항목에 숫자 타입의 'id'가 없습니다.`, validatedMembers: null };
        if (typeof member.name !== 'string') return { isValid: false, error: `${i + 1}번째 항목에 문자열 타입의 'name'이 없습니다.`, validatedMembers: null };
        if (typeof member.position !== 'string' || !POSITIONS.includes(member.position as any)) return { isValid: false, error: `${i + 1}번째 항목의 'position' 값이 유효하지 않습니다: ${member.position}`, validatedMembers: null };
        if (typeof member.phone !== 'string') return { isValid: false, error: `${i + 1}번째 항목에 문자열 타입의 'phone'이 없습니다.`, validatedMembers: null };
        if (typeof member.attendance !== 'object' || member.attendance === null) return { isValid: false, error: `${i + 1}번째 항목에 객체 타입의 'attendance'가 없습니다.`, validatedMembers: null };
        
        for (const date in member.attendance) {
            if (Object.prototype.hasOwnProperty.call(member.attendance, date)) {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !ATTENDANCE_STATUSES.includes(member.attendance[date])) {
                     return { isValid: false, error: `${member.name}님의 '${date}' 날짜의 출석 데이터('${member.attendance[date]}')가 올바르지 않습니다.`, validatedMembers: null };
                }
            }
        }
        validatedMembers.push(member as Member);
    }

    return { isValid: true, error: null, validatedMembers };
};


const App: FC = () => {
    const [members, setMembers] = useState<Member[]>(() => {
        try {
            const savedMembersRaw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedMembersRaw) {
                let parsedMembers = JSON.parse(savedMembersRaw);
                // Simple migration for old data structure
                if (parsedMembers.length > 0 && parsedMembers[0].status !== undefined) {
                     const today = getTodayString();
                     parsedMembers = parsedMembers.map((member: any) => {
                        const newMember = { ...member, attendance: {} };
                        if (member.status) {
                            newMember.attendance[today] = member.status;
                        }
                        delete newMember.status;
                        return newMember;
                    });
                }
                return parsedMembers.sort((a: Member, b: Member) => a.name.localeCompare(b.name, 'ko'));
            }
            return initialMembers;
        } catch (error) {
            console.error("Could not load members from localStorage", error);
            return initialMembers;
        }
    });
    
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
    const saveStatusTimeoutRef = useRef<number | null>(null);
    const isInitialMount = useRef(true);

    useEffect(() => {
        try {
            window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(members));
            
            if (isInitialMount.current) {
                isInitialMount.current = false;
                return;
            }

            if (saveStatusTimeoutRef.current) {
                clearTimeout(saveStatusTimeoutRef.current);
            }
            setSaveStatus('saved');
            saveStatusTimeoutRef.current = window.setTimeout(() => {
                setSaveStatus('idle');
            }, 2000);

        } catch (error) {
            console.error("Could not save members to localStorage", error);
        }
        
        return () => {
            if (saveStatusTimeoutRef.current) {
                clearTimeout(saveStatusTimeoutRef.current);
            }
        }
    }, [members]);

    const [positionFilter, setPositionFilter] = useState<string>(ALL_FILTER);
    const [statusFilter, setStatusFilter] = useState<AttendanceStatus | typeof ALL_FILTER>(ALL_FILTER);
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [viewingMember, setViewingMember] = useState<Member | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [viewingDate, setViewingDate] = useState<string>(getTodayString());
    const [year, setYear] = useState(new Date().getFullYear());
    const [currentPage, setCurrentPage] = useState(1);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const filteredMembers = useMemo(() => {
        return members.filter(member => {
            const positionMatch = positionFilter === ALL_FILTER || member.position === positionFilter;
            const statusMatch = statusFilter === ALL_FILTER || (member.attendance[viewingDate] || null) === statusFilter;
            return positionMatch && statusMatch;
        });
    }, [members, positionFilter, statusFilter, viewingDate]);

    const attendanceCounts = useMemo(() => {
        const membersToCount = members.filter(member => {
            return positionFilter === ALL_FILTER || member.position === positionFilter;
        });

        const present = membersToCount.filter(m => m.attendance[viewingDate] === '출석').length;
        const absent = membersToCount.filter(m => m.attendance[viewingDate] === '결석').length;
        const total = membersToCount.length;
        
        return { total, present, absent };
    }, [members, positionFilter, viewingDate]);


    // Reset page to 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [positionFilter, statusFilter, viewingDate]);
    
    const totalPages = useMemo(() => Math.ceil(filteredMembers.length / ITEMS_PER_PAGE), [filteredMembers.length]);

    const paginatedMembers = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return filteredMembers.slice(startIndex, endIndex);
    }, [filteredMembers, currentPage]);


    const handleResetFilters = useCallback(() => {
        setPositionFilter(ALL_FILTER);
        setStatusFilter(ALL_FILTER);
        setViewingDate(getTodayString());
        setYear(new Date().getFullYear());
    }, []);

    const handleAttendanceChange = useCallback((id: number, date: string, newStatus: AttendanceStatus | '미정') => {
        setMembers(prevMembers =>
            prevMembers.map(member => {
                if (member.id === id) {
                    const newAttendance = { ...member.attendance };
                    if (newStatus === '미정') {
                        delete newAttendance[date];
                    } else {
                        newAttendance[date] = newStatus;
                    }
                    return { ...member, attendance: newAttendance };
                }
                return member;
            })
        );
    }, []);

    const handleSelectionChange = useCallback((id: number) => {
        setSelectedMemberIds(prevSelected => {
            const newSelected = new Set(prevSelected);
            if (newSelected.has(id)) {
                newSelected.delete(id);
            } else {
                newSelected.add(id);
            }
            return newSelected;
        });
    }, []);
    
    const handleAddMember = useCallback((data: { name: string; position: Position; phone: string }) => {
        setMembers(prevMembers => {
            const newMember: Member = {
                id: (prevMembers.length > 0 ? Math.max(...prevMembers.map(m => m.id)) : 0) + 1,
                name: data.name,
                position: data.position,
                phone: data.phone,
                attendance: {},
            };
            const updatedMembers = [...prevMembers, newMember];
            updatedMembers.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
            return updatedMembers;
        });
        setIsAddModalOpen(false);
    }, []);
    
    const handleSaveMember = useCallback((updatedMemberData: Omit<Member, 'attendance'>) => {
        setMembers(prevMembers =>
            prevMembers.map(m => (m.id === updatedMemberData.id ? { ...m, ...updatedMemberData } : m))
        );
        setEditingMember(null);
    }, []);

    const handleDeleteMember = useCallback((memberToDelete: Member) => {
        if (window.confirm(`'${memberToDelete.name}' 교인을 정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
            setMembers(prevMembers => prevMembers.filter(m => m.id !== memberToDelete.id));
            setSelectedMemberIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(memberToDelete.id);
                return newSet;
            });
        }
    }, []);

    const handleSelectAllVisible = useCallback(() => {
        const visibleIds = paginatedMembers.map(m => m.id);
        const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedMemberIds.has(id));

        if (allVisibleSelected) {
            setSelectedMemberIds(prev => {
                const newSet = new Set(prev);
                visibleIds.forEach(id => newSet.delete(id));
                return newSet;
            });
        } else {
            setSelectedMemberIds(prev => new Set([...prev, ...visibleIds]));
        }
    }, [paginatedMembers, selectedMemberIds]);

    const handleClearSelection = useCallback(() => {
        setSelectedMemberIds(new Set());
    }, []);

    const handleSendSms = useCallback(() => {
        if (selectedMemberIds.size === 0) return;
        
        const phoneNumbers = members
            .filter(m => selectedMemberIds.has(m.id))
            .map(m => m.phone.replace(/-/g, ''));
            
        if (phoneNumbers.length > 0) {
            window.location.href = `sms:${phoneNumbers.join(',')}`;
        }
    }, [selectedMemberIds, members]);

    const handleExportData = useCallback(() => {
        if (members.length === 0) {
            alert('내보낼 데이터가 없습니다.');
            return;
        }
        try {
            const dataStr = JSON.stringify(members, null, 2);

            // Action 1: Download data as a file
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            const today = new Date().toISOString().split('T')[0];
            link.download = `예배출석_${today}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            // Action 2: Copy to clipboard and ask to open Naver Band
            const copyAndOpenBand = async () => {
                let message = '데이터 파일이 컴퓨터에 저장되었습니다.\n\n네이버 밴드를 열어 데이터를 붙여넣기 하시겠습니까?';
                
                if (navigator.clipboard && window.isSecureContext) {
                    try {
                        await navigator.clipboard.writeText(dataStr);
                        message = '데이터 파일 저장 및 클립보드 복사가 완료되었습니다.\n\n네이버 밴드를 열어 데이터를 붙여넣기 하시겠습니까?';
                    } catch (err) {
                        console.error('클립보드 복사 실패:', err);
                        message = '데이터 파일은 저장되었지만 클립보드 복사에 실패했습니다.\n\n네이버 밴드를 열어 수동으로 백업하시겠습니까?';
                    }
                }
                
                if (window.confirm(message)) {
                    window.open('https://band.us', '_blank', 'noopener,noreferrer');
                }
            };

            // Delay slightly to ensure file download has initiated.
            setTimeout(copyAndOpenBand, 100);

        } catch (error) {
            console.error("Failed to export data", error);
            alert('데이터 내보내기에 실패했습니다.');
        }
    }, [members]);

    const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        const inputElement = event.target;

        const resetInput = () => {
            if (inputElement) {
                inputElement.value = '';
            }
        };

        if (!file) {
            resetInput();
            return;
        }

        try {
            const fileContent = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (e.target && typeof e.target.result === 'string') {
                        resolve(e.target.result);
                    } else {
                        reject(new Error("파일을 읽었지만 내용이 비어있거나 텍스트가 아닙니다."));
                    }
                };
                reader.onerror = () => {
                    reject(new Error("파일을 읽는 도중 오류가 발생했습니다."));
                };
                reader.readAsText(file);
            });

            let parsedData;
            try {
                parsedData = JSON.parse(fileContent);
            } catch (jsonError) {
                throw new Error("파일이 올바른 JSON 형식이 아닙니다. 텍스트 편집기에서 파일 내용을 확인해주세요.");
            }

            const { isValid, error, validatedMembers } = validateImportedData(parsedData);
            if (!isValid || !validatedMembers) {
                throw new Error(error || "데이터 구조가 올바르지 않습니다.");
            }
            
            const confirmation = window.confirm(
                `총 ${validatedMembers.length}명의 데이터를 가져옵니다.\n\n⚠️ 경고: 이 작업은 현재 앱에 저장된 모든 데이터를 덮어씁니다.\n\n계속하시겠습니까?`
            );

            if (confirmation) {
                const sortedMembers = validatedMembers.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
                setMembers(sortedMembers);
                handleResetFilters();
                alert(`✅ 성공적으로 ${validatedMembers.length}명의 데이터를 가져왔습니다! 화면이 초기화됩니다.`);
            } else {
                alert("데이터 가져오기 작업을 취소했습니다.");
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
            console.error("데이터 가져오기 실패:", error);
            alert(`❌ 데이터 가져오기 실패:\n\n${errorMessage}`);
        } finally {
            resetInput();
        }
    };

    const triggerImport = useCallback(() => {
        fileInputRef.current?.click();
    }, []);


    const attendanceHeader = viewingDate === getTodayString() ? '금일 출결' : '선택일 출결';

    return (
        <div className="app-container">
            <header>
                <div 
                  className="header-title-container" 
                  onClick={handleResetFilters} 
                  role="button" 
                  tabIndex={0} 
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleResetFilters(); } }}
                  aria-label="홈으로 이동 및 필터 초기화"
                >
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                        className="header-icon"
                        aria-hidden="true"
                    >
                        <path d="M11 2 V7 H5 V9 H11 V22 H13 V9 H19 V7 H13 V2 Z" />
                    </svg>
                    <h1>예배 출석부</h1>
                </div>
                <div className="header-actions">
                    <span className={`save-status ${saveStatus === 'saved' ? 'visible' : ''}`} aria-live="polite">
                        자동 저장됨
                    </span>
                    <button className="btn" onClick={() => setIsAddModalOpen(true)}>
                        새 교인 추가
                    </button>
                </div>
            </header>
            <main>
                <div className="year-navigator">
                    <button onClick={() => setYear(y => y - 1)} aria-label="이전 연도">&lt;</button>
                    <h2 aria-live="polite">{year}년</h2>
                    <button onClick={() => setYear(y => y + 1)} aria-label="다음 연도">&gt;</button>
                </div>
                <YearlySundayCalendar year={year} selectedDate={viewingDate} onDateSelect={setViewingDate} />

                <section className="attendance-quick-filter" aria-label="출결 빠른 필터">
                    <button className="btn btn-present-view" onClick={() => setStatusFilter('출석')} disabled={!viewingDate}>출석 보기</button>
                    <button className="btn btn-absent-view" onClick={() => setStatusFilter('결석')} disabled={!viewingDate}>결석 보기</button>
                    <button className="btn" onClick={handleResetFilters}>초기화</button>
                </section>
                
                <div className="main-controls-container">
                    <section className="attendance-status-filter" aria-label="출결별 필터링">
                        <div className="filter-group">
                            <h2>{attendanceHeader}별 보기</h2>
                            <div className="filter-buttons">
                                <button className={`btn ${statusFilter === ALL_FILTER ? 'active' : ''}`} onClick={() => setStatusFilter(ALL_FILTER)}>{ALL_FILTER} ({attendanceCounts.total})</button>
                                {ATTENDANCE_STATUSES.map(status => {
                                    const count = status === '출석' ? attendanceCounts.present : attendanceCounts.absent;
                                    return (
                                        <button key={status} className={`btn ${statusFilter === status ? 'active' : ''}`} onClick={() => setStatusFilter(status)}>{status} ({count})</button>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                    
                    <section className="position-filter-section" aria-label="필터링 옵션">
                        <div className="filter-group">
                            <h2>직분별 보기</h2>
                            <select
                                className="position-filter-select"
                                value={positionFilter}
                                onChange={(e) => setPositionFilter(e.target.value)}
                                aria-label="직분으로 필터링"
                            >
                                <option value={ALL_FILTER}>{ALL_FILTER}</option>
                                {POSITIONS.map((pos) => (
                                    <option key={pos} value={pos}>
                                        {pos}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </section>

                    <section className="actions" aria-label="일괄 작업">
                        <div className="actions-bar">
                            <span className="selection-info">{selectedMemberIds.size}명 선택됨</span>
                            <button className="btn" onClick={handleSelectAllVisible} disabled={paginatedMembers.length === 0}>
                                {paginatedMembers.length > 0 && paginatedMembers.every(m => selectedMemberIds.has(m.id)) ? '현재 페이지 해제' : '현재 페이지 선택'}
                            </button>
                            <button className="btn" onClick={handleClearSelection} disabled={selectedMemberIds.size === 0}>
                            선택 해제
                            </button>
                            <button className="btn btn-sms" onClick={handleSendSms} disabled={selectedMemberIds.size === 0}>
                                단체 문자
                            </button>
                        </div>
                    </section>
                </div>

                <div className="table-container">
                    <table className="member-table">
                        <thead>
                            <tr>
                                <th className="col-checkbox"><input type="checkbox" onChange={handleSelectAllVisible} checked={paginatedMembers.length > 0 && paginatedMembers.every(m => selectedMemberIds.has(m.id))} aria-label="현재 페이지 전체 선택" /></th>
                                <th className="col-tight">이름</th>
                                <th className="col-tight">직분</th>
                                <th className="col-tight">{attendanceHeader}</th>
                                <th>전화번호</th>
                                <th>수정</th>
                                <th>삭제</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedMembers.length > 0 ? (
                                paginatedMembers.map(member => (
                                    <tr key={member.id}>
                                        <td className="col-checkbox"><input type="checkbox" checked={selectedMemberIds.has(member.id)} onChange={() => handleSelectionChange(member.id)} aria-label={`${member.name} 선택`} /></td>
                                        <td className="member-name-link col-tight" onClick={() => setViewingMember(member)}>{member.name}</td>
                                        <td className="col-tight">{member.position}</td>
                                        <td className="attendance-cell col-tight">
                                            <div className="attendance-buttons">
                                                <button
                                                    className={`btn-attendance btn-present ${member.attendance[viewingDate] === '출석' ? 'active' : ''}`}
                                                    onClick={() => handleAttendanceChange(member.id, viewingDate, member.attendance[viewingDate] === '출석' ? '미정' : '출석')}
                                                >
                                                    출석
                                                </button>
                                                <button
                                                    className={`btn-attendance btn-absent ${member.attendance[viewingDate] === '결석' ? 'active' : ''}`}
                                                    onClick={() => handleAttendanceChange(member.id, viewingDate, member.attendance[viewingDate] === '결석' ? '미정' : '결석')}
                                                >
                                                    결석
                                                </button>
                                            </div>
                                        </td>
                                        <td>{member.phone}</td>
                                        <td><button className="btn btn-edit" onClick={() => setEditingMember(member)}>수정</button></td>
                                        <td><button className="btn btn-delete" onClick={() => handleDeleteMember(member)}>삭제</button></td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="no-members">해당 조건에 맞는 교인이 없습니다.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                {totalPages > 1 && (
                    <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                )}

                <section className="manual-save-section">
                    <button className="btn btn-save" onClick={handleExportData}>
                        저장(백업)
                    </button>
                </section>
                                
                <section className="data-management" aria-labelledby="data-management-title">
                    <div className="data-management-header">
                        <h2 id="data-management-title">⚠️ 데이터 백업 (매우 중요)</h2>
                        <p className="data-management-description">
                           모든 데이터는 브라우저에 자동 저장됩니다. 하지만, <strong>제가 새로운 기능을 추가해 드릴 때마다 이 데이터가 초기화될 수 있습니다.</strong><br/>
                           따라서, 중요한 작업을 마치신 후에는 반드시 <strong>아래 '내보내기' 버튼으로 데이터를 파일로 백업</strong>해주세요.
                        </p>
                    </div>
                    <div className="data-buttons">
                        <button className="btn" onClick={handleExportData}>데이터 파일로 내보내기</button>
                        <button className="btn" onClick={triggerImport}>파일에서 데이터 가져오기</button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImportData}
                            style={{ display: 'none' }}
                            accept="application/json"
                        />
                    </div>
                </section>
            </main>
            {isAddModalOpen && ( <AddMemberModal onSave={handleAddMember} onCancel={() => setIsAddModalOpen(false)} /> )}
            {editingMember && ( <EditMemberModal member={editingMember} onSave={handleSaveMember} onCancel={() => setEditingMember(null)} /> )}
            {viewingMember && ( <MemberDetailModal member={viewingMember} onClose={() => setViewingMember(null)} /> )}
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}