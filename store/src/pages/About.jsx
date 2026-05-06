// src/pages/About.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Truck,
  Scale,
  UtensilsCrossed,
  ArrowLeft,
  CheckCircle2,
  Store,
  Users,
  Target,
  HeartHandshake
} from 'lucide-react';
import aboutImage from '../assets/about-hero.png';
import { useTranslation } from 'react-i18next';

const About = () => {
  const { t } = useTranslation();

  const stats =[
    { label: t('about_page.stats.customers'), value: '+10,000', icon: Users },
    { label: t('about_page.stats.orders'), value: '+25,000', icon: CheckCircle2 },
    { label: t('about_page.stats.farms'), value: '+30', icon: Store },
  ];

  const features =[
    {
      icon: ShieldCheck,
      title: t('about_page.features.quality_title'),
      desc: t('about_page.features.quality_desc'),
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      icon: Scale,
      title: t('about_page.features.scale_title'),
      desc: t('about_page.features.scale_desc'),
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      icon: UtensilsCrossed,
      title: t('about_page.features.slaughter_title'),
      desc: t('about_page.features.slaughter_desc'),
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      icon: Truck,
      title: t('about_page.features.delivery_title'),
      desc: t('about_page.features.delivery_desc'),
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ];

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-gray-900 to-gray-800 text-white py-20 overflow-hidden rounded-b-[3rem]">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="container mx-auto px-4 relative z-10 text-center max-w-4xl">
          <span className="inline-block py-1.5 px-4 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-yellow-400 mb-6 backdrop-blur-sm tracking-wide">
            {t('about_page.badge')}
          </span>
          <h1 className="text-3xl md:text-5xl font-black mb-6 leading-tight" dangerouslySetInnerHTML={{ __html: t('about_page.title_main') }}></h1>
          <p className="text-gray-300 text-base md:text-xl leading-relaxed">
            {t('about_page.desc')}
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <div className="container mx-auto px-4 -mt-10 relative z-20">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-8 grid grid-cols-3 gap-4 text-center divide-x-reverse md:divide-none divide-gray-100">
          {stats.map((stat, index) => (
            <div key={index} className="flex flex-col items-center">
              <stat.icon className="w-6 h-6 md:w-8 md:h-8 text-primary mb-2 opacity-80" />
              <span className="text-xl md:text-3xl font-black text-dark block">{stat.value}</span>
              <span className="text-[10px] md:text-sm text-gray-500 font-medium">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Story Section */}
      <section className="py-12 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center md:text-start mb-6 md:mb-12 max-w-4xl mx-auto md:mx-0">
            <span className="text-primary font-bold tracking-wider uppercase text-sm mb-2 block">
              {t('about_page.story.badge')}
            </span>
            <h2 className="text-2xl md:text-4xl font-black text-dark leading-tight">
              {t('about_page.story.title')}
            </h2>
          </div>

          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-20">
            <div className="w-full lg:w-1/2 order-2 lg:order-1 relative rounded-[2rem] overflow-hidden lg:overflow-visible lg:bg-transparent shadow-xl lg:shadow-none">

              {}
              <div className="absolute inset-0 lg:hidden">
                <img
                  src={aboutImage}
                  alt="تطبيق لحم"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/80"></div>
              </div>

              {}
              <div className="relative z-10 p-8 lg:p-0 text-white lg:text-gray-600">
                <div className="space-y-4 text-sm md:text-lg leading-loose text-justify font-medium lg:font-normal">
                  <p>{t('about_page.story.p1')}</p>
                  <p dangerouslySetInnerHTML={{ __html: t('about_page.story.p2').replace('"لَحِم"', '<strong>"لَحِم"</strong>') }} />
                </div>

                {/*   (Grid)      */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                  <div className="p-5 rounded-2xl bg-white/10 lg:bg-secondary/20 border border-white/20 lg:border-gray-100 backdrop-blur-sm lg:backdrop-blur-none">
                    <div className="bg-white w-12 h-12 flex items-center justify-center rounded-xl shadow-sm text-primary mb-4">
                      <Target size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-white lg:text-dark mb-2">{t('about_page.story.mission_title')}</h3>
                    <p className="text-gray-200 lg:text-gray-600 text-sm m-0 leading-relaxed">
                      {t('about_page.story.mission_desc')}
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-white/10 lg:bg-secondary/20 border border-white/20 lg:border-gray-100 backdrop-blur-sm lg:backdrop-blur-none">
                    <div className="bg-white w-12 h-12 flex items-center justify-center rounded-xl shadow-sm text-primary mb-4">
                      <HeartHandshake size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-white lg:text-dark mb-2">{t('about_page.story.vision_title')}</h3>
                    <p className="text-gray-200 lg:text-gray-600 text-sm m-0 leading-relaxed">
                      {t('about_page.story.vision_desc')}
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {}
            <div className="hidden lg:block lg:w-1/2 w-full order-1 lg:order-2 relative">
              <div className="absolute -top-4 -right-4 w-2/3 h-2/3 bg-yellow-400/20 rounded-[2rem] -z-10"></div>
              <div className="absolute -bottom-4 -left-4 w-2/3 h-2/3 bg-primary/10 rounded-[2rem] -z-10"></div>

              <div className="relative rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white">
                <img
                  src={aboutImage}
                  alt="مزرعة لحم الذكية"
                  className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
                  style={{ minHeight: '80px' }}
                  onError={(e) => { e.target.src = "/default-image.png"; }}
                />

                <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-gray-100 max-w-[200px]">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="text-green-600" size={20} />
                    <span className="font-bold text-dark text-sm">{t('about_page.features.quality_title').split(' ').slice(0, 2).join(' ')}</span>
                  </div>
                  <p className="text-xs text-gray-500 m-0">
                    {t('about_page.features.quality_desc').split('،')[0]}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 bg-gray-50/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-xl md:text-3xl font-black text-dark mb-2">{t('about_page.features.title')}</h2>
            <p className="text-gray-500 text-sm md:text-base">{t('about_page.features.subtitle')}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            {features.map((feat, index) => {
              const Icon = feat.icon;
              return (
                <div
                  key={index}
                  className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 text-center flex flex-col items-center h-full"
                >
                  <div
                    className={`w-10 h-10 md:w-14 md:h-14 ${feat.bg} ${feat.color} rounded-xl flex items-center justify-center mb-3`}
                  >
                    <Icon size={20} className="md:w-7 md:h-7" />
                  </div>
                  <h3 className="font-bold text-dark text-xs md:text-lg mb-2 leading-tight">
                    {feat.title}
                  </h3>
                  <p className="text-[10px] md:text-sm text-gray-500 leading-tight md:leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center pb-12 pt-12">
        <h2 className="text-xl md:text-3xl font-black text-dark mb-2">
          {t('about_page.cta.title')}
        </h2>
        <p className="text-gray-500 mb-6 text-sm">{t('about_page.cta.subtitle')}</p>
        <Link
          to="/livestock"
          className="btn btn-primary px-8 py-3 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all inline-flex items-center gap-2 font-bold"
        >
          {t('about_page.cta.btn')}
          <ArrowLeft size={18} />
        </Link>
      </section>
    </div>
  );
};

export default About;