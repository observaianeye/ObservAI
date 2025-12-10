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
        light: "bg-white/10 border-white/20 text-gray-800 shadow-lg",
        dark: "bg-black/60 border-white/10 text-white shadow-xl",
        neon: "bg-gray-900/80 border-blue-500/30 text-white shadow-[0_0_15px_rgba(59,130,246,0.1)] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:border-blue-500/50"
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
