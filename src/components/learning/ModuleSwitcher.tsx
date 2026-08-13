import { NavLink } from 'react-router-dom';
import React from 'react';

/**
 * Navigation component that renders pill links for German language modules.
 * - Links: /alphabet, /numbers, /calendar, /articles, /greetings
 * - Optional /learn link
 * - Active link styling via NavLink's isActive prop
 * - aria-label="A1 modules" for accessibility
 * - Horizontal scroll container for mobile views
 */
const ModuleSwitcher: React.FC = () => (
  <nav
    aria-label="A1 modules"
    style={{
      overflowX: 'auto',
      whiteSpace: 'nowrap',
      padding: '0.5rem 0',
    }}
  >
    <NavLink
      to="/alphabet"
      className={({ isActive }) =>
        `px-4 py-2 rounded mr-2 text-sm font-medium ${
          isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
        } transition-colors`
      }
    >
      Alphabet
    </NavLink>

    <NavLink
      to="/numbers"
      className={({ isActive }) =>
        `px-4 py-2 rounded mr-2 text-sm font-medium ${
          isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
        } transition-colors`
      }
    >
      Numbers
    </NavLink>

    <NavLink
      to="/calendar"
      className={({ isActive }) =>
        `px-4 py-2 rounded mr-2 text-sm font-medium ${
          isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
        } transition-colors`
      }
    >
      Calendar
    </NavLink>

    <NavLink
      to="/articles"
      className={({ isActive }) =>
        `px-4 py-2 rounded mr-2 text-sm font-medium ${
          isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
        } transition-colors`
      }
    >
      Articles
    </NavLink>

    <NavLink
      to="/greetings"
      className={({ isActive }) =>
        `px-4 py-2 rounded mr-2 text-sm font-medium ${
          isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
        } transition-colors`
      }
    >
      Greetings
    </NavLink>

    <NavLink
      to="/learn"
      className={({ isActive }) =>
        `px-4 py-2 rounded mr-2 text-sm font-medium ${
          isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
        } transition-colors`
      }
    >
      Learn
    </NavLink>
  </nav>
);

export { ModuleSwitcher };
