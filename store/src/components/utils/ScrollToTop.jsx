// D:\frontend\src\components\utils\ScrollToTop.jsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    //    (pathname)    
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
