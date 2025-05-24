import React from 'react';
import { useTranslation } from 'react-i18next';

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  };

  return (
    <div className="flex items-center gap-3 bg-gradient-to-br from-purple-700 to-indigo-900 p-1 shadow-sm">
      <button 
        className={`px-3 py-1.5 border rounded-md transition-colors duration-200 text-sm font-medium
          ${i18n.language === 'en' 
            ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600' 
            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
        onClick={() => changeLanguage('en')}
        aria-pressed={i18n.language === 'en'}
      >
        {t('english')}
      </button>
      <button 
        className={`px-3 py-1.5 border rounded-md transition-colors duration-200 text-sm font-medium
          ${i18n.language === 'hi'
            ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600' 
            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
        onClick={() => changeLanguage('hi')}
        aria-pressed={i18n.language === 'hi'}
      >
        {t('hindi')}
      </button>
    </div>
  );
}

export default LanguageSwitcher;