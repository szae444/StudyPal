import { useState, useEffect } from 'react';
import { addTodo, getUserTodos, updateTodo, deleteTodo } from '../services/firebaseService';
import { Loader2, Trash2, CheckSquare, Square, Plus, ListTodo, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ConfirmDialog from './ConfirmDialog';

export default function Planner({ user }) {
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState('medium');

    // Transfer Mode State
    const [isTransferMode, setIsTransferMode] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);
    const [transferTarget, setTransferTarget] = useState(null);

    // Calendar State
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Date Utilities
    const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const formatDateString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    const goToToday = () => {
        const today = new Date();
        setCurrentMonth(today);
        setSelectedDate(today);
    };

    const fetchTodos = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await getUserTodos(user.uid);
            setTodos(data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load your tasks.');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchTodos();
    }, [user]);

    const handleAddTodo = async (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        const loadingToast = toast.loading('Adding task...');
        try {
            const dateStr = formatDateString(selectedDate);
            const newId = await addTodo(user.uid, newTaskTitle, '', newTaskPriority, dateStr);
            setTodos([{
                id: newId, 
                title: newTaskTitle, 
                priority: newTaskPriority, 
                dueDate: dateStr,
                completed: false,
                createdAt: { toMillis: () => Date.now() }
            }, ...todos]);
            setNewTaskTitle('');
            toast.success('Task added!', { id: loadingToast });
        } catch (err) {
            toast.error('Failed to add task', { id: loadingToast });
        }
    };

    const handleToggleTodo = async (todo) => {
        try {
            const updatedTodos = todos.map(t => 
                t.id === todo.id ? { ...t, completed: !t.completed } : t
            );
            setTodos(updatedTodos);
            await updateTodo(todo.id, { completed: !todo.completed });
        } catch (err) {
            toast.error('Failed to update task');
            fetchTodos();
        }
    };

    const handleDeleteTodo = async (id) => {
        try {
            await deleteTodo(id);
            setTodos(todos.filter((t) => t.id !== id));
            toast.success('Task deleted');
        } catch (err) {
            toast.error('Failed to delete task');
        }
    };

    const requestTransferTasks = (targetDate) => {
        const sourceDateStr = formatDateString(selectedDate);
        const targetDateStr = formatDateString(targetDate);

        if (sourceDateStr === targetDateStr) {
            toast.error('Source and target dates are the same');
            return;
        }

        const tasksToTransfer = todos.filter(t => t.dueDate === sourceDateStr);
        if (tasksToTransfer.length === 0) {
            toast.error('No tasks to transfer');
            setIsTransferMode(false);
            return;
        }

        setTransferTarget(targetDate);
    };

    const confirmTransferTasks = async () => {
        const targetDate = transferTarget;
        setTransferTarget(null);

        const sourceDateStr = formatDateString(selectedDate);
        const targetDateStr = formatDateString(targetDate);
        const tasksToTransfer = todos.filter(t => t.dueDate === sourceDateStr);

        setIsTransferring(true);
        const loadingToast = toast.loading('Transferring tasks...');

        try {
            // Update each task in Firebase
            await Promise.all(tasksToTransfer.map(task =>
                updateTodo(task.id, { dueDate: targetDateStr })
            ));

            // Update local state
            setTodos(prev => prev.map(task =>
                task.dueDate === sourceDateStr ? { ...task, dueDate: targetDateStr } : task
            ));

            toast.success('Tasks transferred successfully!', { id: loadingToast });
            setSelectedDate(targetDate);
        } catch (err) {
            console.error(err);
            toast.error('Failed to transfer tasks', { id: loadingToast });
        } finally {
            setIsTransferring(false);
            setIsTransferMode(false);
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high': return 'var(--error)';
            case 'medium': return 'var(--warning)';
            case 'low': return 'var(--success)';
            default: return 'var(--text-muted)';
        }
    };

    // Calendar Generation
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const calendarDays = [];
    
    // Empty padding days
    for (let i = 0; i < firstDay; i++) {
        calendarDays.push(null);
    }
    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
        calendarDays.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
    }

    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const selectedDateStr = formatDateString(selectedDate);
    const selectedTodos = todos.filter(t => t.dueDate === selectedDateStr);

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
                <Loader2 className="spinner" size={48} color="var(--accent-primary)" />
                <h3 style={{ marginTop: '1rem', color: 'var(--text-primary)' }}>Loading Planner...</h3>
            </div>
        );
    }

    return (
        <div className="fade-in">
            <div className="planner-header" style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: 'var(--text-primary)' }}>Planner</h2>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Organize your study schedule and daily tasks.</p>
                </div>
            </div>

            <div className="planner-panes" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                
                {/* LEFT PANE: CALENDAR */}
                <div className="glass-panel planner-calendar-pane" style={{ flex: '1 1 300px', minWidth: 0, padding: '2rem', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        </h3>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={prevMonth} className="btn-secondary" style={{ padding: '0.5rem', borderRadius: '8px' }} title="Previous Month">
                                <ChevronLeft size={18} />
                            </button>
                            <button onClick={goToToday} className="btn-secondary" style={{ padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem' }} title="Go to Today">
                                Today
                            </button>
                            <button onClick={nextMonth} className="btn-secondary" style={{ padding: '0.5rem', borderRadius: '8px' }} title="Next Month">
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                        {WEEKDAYS.map(day => (
                            <div key={day} style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                {day}
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
                        {calendarDays.map((day, index) => {
                            if (!day) return <div key={`empty-${index}`} className="calendar-day" style={{ minHeight: '60px' }} />;
                            
                            const dayStr = formatDateString(day);
                            const isSelected = selectedDateStr === dayStr;
                            const isToday = formatDateString(new Date()) === dayStr;
                            const dayTodos = todos.filter(t => t.dueDate === dayStr);
                            const activeTodosCount = dayTodos.filter(t => !t.completed).length;

                            return (
                                <button
                                    key={dayStr}
                                    onClick={() => {
                                        if (isTransferMode) {
                                            requestTransferTasks(day);
                                        } else {
                                            setSelectedDate(day);
                                        }
                                    }}
                                    style={{
                                        minHeight: '60px',
                                        padding: '0.5rem',
                                        borderRadius: '12px',
                                        background: isSelected ? 'var(--accent-primary)' : (isToday ? 'rgba(0,0,0,0.03)' : 'transparent'),
                                        color: isSelected ? 'var(--bg-primary)' : 'var(--text-primary)',
                                        border: isTransferMode ? '2px dashed var(--accent-primary)' : (isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)'),
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        transition: 'all 0.2s ease',
                                        cursor: 'pointer'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected) {
                                            e.currentTarget.style.background = 'var(--bg-glass-hover)';
                                            e.currentTarget.style.borderColor = 'var(--text-muted)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSelected) {
                                            e.currentTarget.style.background = isToday ? 'rgba(0,0,0,0.03)' : 'transparent';
                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                        }
                                    }}
                                >
                                    <span style={{ fontSize: '1rem', fontWeight: isToday || isSelected ? 700 : 500 }}>
                                        {day.getDate()}
                                    </span>
                                    
                                    {dayTodos.length > 0 && activeTodosCount > 0 && (
                                        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isSelected ? 'var(--bg-primary)' : 'var(--accent-primary)' }} />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT PANE: TO-DO LIST */}
                <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem', margin: 0 }}>
                                <CalendarIcon size={20} color="var(--accent-primary)" />
                                Tasks for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </h3>
                            {selectedTodos.length > 0 && (
                                <button
                                    onClick={() => setIsTransferMode(!isTransferMode)}
                                    className={isTransferMode ? "btn-primary" : "btn-secondary"}
                                    style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem' }}
                                >
                                    {isTransferMode ? "Cancel Transfer" : "Transfer Tasks"}
                                </button>
                            )}
                        </div>

                        {isTransferMode && (
                            <div style={{ 
                                padding: '0.75rem', 
                                background: 'rgba(26, 26, 26, 0.05)', 
                                borderRadius: '10px', 
                                fontSize: '0.9rem', 
                                color: 'var(--accent-primary)',
                                borderLeft: '4px solid var(--accent-primary)',
                                fontWeight: 500
                            }}>
                                Select a target date on the calendar to move all tasks from {selectedDate.toLocaleDateString()}.
                            </div>
                        )}

                        <form onSubmit={handleAddTodo} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                                type="text"
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                placeholder="Add a new task..."
                                style={{
                                    flex: 1, minWidth: '200px', padding: '0.75rem 1rem', borderRadius: '10px',
                                    border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                                    color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none'
                                }}
                            />
                            <select
                                value={newTaskPriority}
                                onChange={(e) => setNewTaskPriority(e.target.value)}
                                className="select-field"
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                            <button type="submit" className="btn-primary" style={{ padding: '0.75rem 1rem', borderRadius: '10px' }} disabled={!newTaskTitle.trim()}>
                                <Plus size={18} />
                            </button>
                        </form>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {selectedTodos.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem 2rem', background: 'var(--bg-glass)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
                                <CheckSquare size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
                                <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No tasks for this date.</h4>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Enjoy your day or schedule some study sessions!</p>
                            </div>
                        ) : (
                            selectedTodos.map((todo, index) => (
                                <div
                                    key={todo.id}
                                    className="glass-panel slide-up"
                                    style={{
                                        animationDelay: `${index * 0.05}s`,
                                        padding: '1rem 1.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        opacity: todo.completed ? 0.6 : 1,
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <button
                                        onClick={() => handleToggleTodo(todo)}
                                        style={{
                                            color: todo.completed ? 'var(--success)' : 'var(--text-muted)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        {todo.completed ? <CheckSquare size={22} /> : <Square size={22} />}
                                    </button>

                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <span style={{
                                            fontSize: '1rem', fontWeight: 500,
                                            textDecoration: todo.completed ? 'line-through' : 'none',
                                            color: todo.completed ? 'var(--text-muted)' : 'var(--text-primary)'
                                        }}>
                                            {todo.title}
                                        </span>
                                    </div>

                                    <span style={{
                                        padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.7rem',
                                        fontWeight: 700, textTransform: 'uppercase', color: getPriorityColor(todo.priority),
                                        background: `color-mix(in srgb, ${getPriorityColor(todo.priority)} 15%, transparent)`
                                    }}>
                                        {todo.priority}
                                    </span>

                                    <button
                                        onClick={() => handleDeleteTodo(todo.id)}
                                        style={{
                                            color: 'var(--text-muted)', padding: '0.4rem', borderRadius: '8px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                                        title="Delete Task"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>

            <ConfirmDialog
                key={transferTarget ? formatDateString(transferTarget) : 'transfer-dialog'}
                open={!!transferTarget}
                title="Transfer Tasks"
                message={transferTarget ? `Move ${todos.filter(t => t.dueDate === formatDateString(selectedDate)).length} task(s) to ${transferTarget.toLocaleDateString()}?` : ''}
                confirmLabel="Transfer"
                onConfirm={confirmTransferTasks}
                onCancel={() => setTransferTarget(null)}
            />
        </div>
    );
}
