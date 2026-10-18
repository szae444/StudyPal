import { createContext, useContext } from 'react';

export const DeskContext = createContext(null);

export const useDesk = () => {
    const ctx = useContext(DeskContext);
    if (!ctx) throw new Error('useDesk must be used inside <DeskProvider>');
    return ctx;
};
