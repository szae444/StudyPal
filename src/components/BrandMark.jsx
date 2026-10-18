// StudyPal mark: a bento tray seen from above — one compartment highlighted.
export default function BrandMark({ size = 32 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
            <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="var(--text-primary)" />
            <rect x="6" y="6" width="11" height="20" rx="3" fill="var(--hl)" />
            <rect x="19.5" y="6" width="6.5" height="8.5" rx="2.5" fill="var(--bg-glass)" opacity="0.92" />
            <rect x="19.5" y="17.5" width="6.5" height="8.5" rx="2.5" fill="var(--bg-glass)" opacity="0.92" />
        </svg>
    );
}
