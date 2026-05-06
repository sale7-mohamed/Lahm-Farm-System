import React from "react";
import RegisterForm from "../components/auth/RegisterForm";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const Register = () => {
  const { t } = useTranslation();

  return (
    <div className="bg-secondary/30 min-h-screen flex flex-col items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
      {}
      <div className="w-full max-w-2xl">
        <RegisterForm />
      </div>

      <div className="mt-6 text-center">
        <p className="text-gray-500 text-sm">
          {t('common.already_have_account', "لديك حساب بالفعل؟")}{" "}
          <Link to="/login" className="font-bold text-primary hover:underline">
            {t('auth.login_btn', 'تسجيل الدخول')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;