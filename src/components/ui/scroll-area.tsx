import React, { forwardRef, useEffect, useRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(({
  className,
  children,
  ...props
}, ref) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  // Function to update the scrollbar thumb position and size
  const updateScrollbar = () => {
    if (!contentRef.current || !scrollbarRef.current || !thumbRef.current) return;

    const content = contentRef.current;
    const scrollbar = scrollbarRef.current;
    const thumb = thumbRef.current;

    // Calculate the ratio of content height to visible height
    const ratio = content.clientHeight / content.scrollHeight;
    
    // Calculate the thumb height
    const thumbHeight = Math.max(20, ratio * scrollbar.clientHeight);
    
    // Calculate the thumb position
    const thumbPosition = (content.scrollTop / content.scrollHeight) * scrollbar.clientHeight;

    // Update thumb styles
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${thumbPosition}px)`;
  };

  // Handle scroll event
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    updateScrollbar();
  };

  // Update scrollbar on mount and when window resizes
  useEffect(() => {
    updateScrollbar();
    
    const handleResize = () => {
      updateScrollbar();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [children]);

  return (
    <div
      ref={ref}
      className={cn('relative overflow-hidden', className)}
      {...props}
    >
      <div
        ref={contentRef}
        className="h-full w-full overflow-y-auto scrollbar-hide"
        onScroll={handleScroll}
      >
        {children}
      </div>
      <div
        ref={scrollbarRef}
        className="absolute right-0 top-0 h-full w-1 bg-background/50 pointer-events-none"
      >
        <div
          ref={thumbRef}
          className="absolute right-0 w-1 bg-primary/50 rounded-full transition-colors hover:bg-primary"
        />
      </div>
    </div>
  );
});

ScrollArea.displayName = 'ScrollArea';

export default ScrollArea;