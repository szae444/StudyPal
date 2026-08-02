import { FileText, HelpCircle, Layers } from 'lucide-react';

export default function Tabs({ activeTab, setActiveTab }) {
    const tabs = [
        { id: 'reviewer', label: 'Reviewer', icon: FileText },
        { id: 'quiz', label: 'Quiz', icon: HelpCircle },
        { id: 'flashcards', label: 'Flashcards', icon: Layers },
    ];

    return (
        <div className="segmented-tabs" style={{ marginBottom: '2rem' }}>
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`segmented-tab ${isActive ? 'active' : ''}`}
                    >
                        <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                        <span>{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
