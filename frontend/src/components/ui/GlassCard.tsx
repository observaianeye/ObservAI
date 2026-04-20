import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    variant?: 'light' | 'dark' | 'neon';
    intensity?: 'low' | 'medium' | 'high';
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(({
    children,
    className = '',
    variant = 'dark',
    intensity = 'medium',
    ...props
}, ref) => {
    const baseStyles = "rounded-xl backdrop-blur-md border transition-all duration-300";

    const variants = {
        light: "bg-white/10 border-white/20 text-ink-1 shadow-lg",
        dark: "bg-surface-1/80 border-white/[0.08] text-ink-0 shadow-xl",
        neon: "bg-surface-1/80 border-brand-500/30 text-ink-0 shadow-[0_0_15px_rgba(29,107,255,0.12)] hover:shadow-glow-brand hover:border-brand-500/50"
    };

    const intensities = {
        low: "backdrop-blur-sm",
        medium: "backdrop-blur-md",
        high: "backdrop-blur-xl"
    };

    return (
        <div
            ref={ref}
            className={`${baseStyles} ${variants[variant]} ${intensities[intensity]} ${className}`}
            {...props}
        >
            {children}
        </div>
    );
});

GlassCard.displayName = 'GlassCard';
