import { useState, useEffect, useCallback } from 'react';

export const useHasPermission = () => {
  const [accessRules, setAccessRules] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('module_access') || '{}');
    } catch {
      return {};
    }
  });

  const [isSuper, setIsSuper] = useState(() =>
    localStorage.getItem('is_superuser') === 'true'
  );

  useEffect(() => {
    const updatePerms = () => {
      try {
        setAccessRules(JSON.parse(localStorage.getItem('module_access') || '{}'));
      } catch {
        setAccessRules({});
      }
      setIsSuper(localStorage.getItem('is_superuser') === 'true');
    };

    window.addEventListener('permissions-updated', updatePerms);
    return () => window.removeEventListener('permissions-updated', updatePerms);
  }, []);

  const checkAccess = useCallback(
    (moduleName, actionOrLevel = 'view', pagePath = null) => {
      // 1.      
      if (isSuper) return true;

      try {
        // 2.    (         )
        let actualModule = moduleName;
        if (moduleName === 'employees') actualModule = 'hr';
        if (moduleName === 'operations') actualModule = 'orders';
        if (moduleName === 'crm') actualModule = 'orders';
        if (moduleName === 'superuser') actualModule = 'settings';

        const ruleObj = accessRules[actualModule];

        if (!ruleObj || !ruleObj.actions) {
          return false;
        }

        const actions = ruleObj.actions;
        const excludedPages = ruleObj.excluded || [];

        // 3.     () 
        if (pagePath && excludedPages.includes(pagePath)) {
          return false;
        }

        // 4.        (True / False)    
        if (actionOrLevel === 'VIEW_ONLY' || actionOrLevel === 'view') {
            return actions.view === true;
        }

        if (actionOrLevel === 'CAN_EDIT' || actionOrLevel === 'edit') {
            return actions.edit === 'allow' || actions.edit === 'approval';
        }

        if (actionOrLevel === 'FULL_ACCESS') {

            return actions.add === 'allow' && actions.edit === 'allow' && actions.delete === 'allow';
        }

        if (actionOrLevel === 'REQUIRE_APPROVAL') {
            //          approval
            return actions.add === 'approval' || actions.edit === 'approval' || actions.delete === 'approval';
        }

        if (['add', 'delete'].includes(actionOrLevel)) {
            return actions[actionOrLevel] === 'allow' || actions[actionOrLevel] === 'approval';
        }

        return false;
      } catch (e) {
        console.error("Error checking permissions", e);
        return false;
      }
    },
    [accessRules, isSuper]
  );

  return checkAccess;
};
