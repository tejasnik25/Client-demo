'use client';

import { useState, useEffect } from 'react';

type ThemeOption = {
  name: string;
  class: string;
  color: string;
};

const ThemeColorToggle = () => {
  const themes: ThemeOption[] = [
    { name: 'Default', class: '', color: 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500' },
    { name: 'Blue', class: 'theme-blue', color: 'bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700' },
    { name: 'Purple', class: 'theme-purple', color: 'bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700' },
    { name: 'Green', class: 'theme-green', color: 'bg-gradient-to-r from-green-500 via-green-600 to-green-700' },
    { name: 'Amber', class: 'theme-amber', color: 'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700' },
    { name: 'Rose', class: 'theme-rose', color: 'bg-gradient-to-r from-rose-500 via-rose-600 to-rose-700' },
  ];
  
  const [currentTheme, setCurrentTheme] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('color-theme') || '';
    setCurrentTheme(savedTheme);
    
    // Apply theme to document
    document.documentElement.className = document.documentElement.className
      .replace(/theme-\w+/g, '')
      .trim();
      
    if (savedTheme) {
      document.documentElement.classList.add(savedTheme);
    }
  }, []);

  const changeTheme = (themeClass: string) => {
    // Remove all theme classes
    document.documentElement.className = document.documentElement.className
      .replace(/theme-\w+/g, '')
      .trim();
    
    // Add new theme class if not default
    if (themeClass) {
      document.documentElement.classList.add(themeClass);
    }
    
    // Save to localStorage
    localStorage.setItem('color-theme', themeClass);
    setCurrentTheme(themeClass);
    setIsOpen(false);
  };

  const getCurrentThemeColor = () => {
    const theme = themes.find(t => t.class === currentTheme) || themes[0];
    return theme.color;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
        aria-label="Change color theme"
      >
        <div className={`w-5 h-5 rounded-full ${getCurrentThemeColor()}`}></div>
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden z-10">
          <div className="p-2">
            {themes.map((theme) => (
              <button
                key={theme.name}
                onClick={() => changeTheme(theme.class)}
                className={`
                  w-full flex items-center p-2 rounded-md text-left text-sm
                  ${currentTheme === theme.class ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}
                `}
              >
                <div className={`w-4 h-4 rounded-full mr-2 ${theme.color}`}></div>
                <span className="text-gray-700 dark:text-gray-200">{theme.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeColorToggle;
