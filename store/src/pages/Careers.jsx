import React, { useState, useEffect } from 'react';
import { Briefcase, MapPin, ArrowLeft, ArrowRight, Clock, DollarSign, Send, FileText, CheckCircle2, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import axios from '../services/axiosConfig';
import Modal from '../components/ui/Modal';

const Careers = () => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';

    const getJobTypeLabel = (type) => {
        const types = {
            'Full-time': t('careers_page.job_types.full_time', 'Full-time'),
            'Part-time': t('careers_page.job_types.part_time', 'Part-time'),
            'Contract': t('careers_page.job_types.contract', 'Contract'),
            'Remote': t('careers_page.job_types.remote', 'Remote'),
            'Shift-based': t('careers_page.job_types.shift_based', 'Shift-based')
        };
        return types[type] || type;
    };

    const [jobs, setJobs] = useState([]);
    const [loadingJobs, setLoadingJobs] = useState(true);

    const[formVisible, setFormVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedJob, setSelectedJob] = useState(null);

    const [applicationData, setApplicationData] = useState({
        name: '',
        phone: '',
        email: '',
        cv_link: '',
        notes: ''
    });

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                const res = await axios.get('/management/jobs/');
                setJobs(res.data.results || res.data ||[]);
            } catch (error) {
                console.error("Failed to load jobs", error);
            } finally {
                setLoadingJobs(false);
            }
        };
        fetchJobs();
    },[]);

    const handleApplyClick = (job) => {
        setSelectedJob(job);
        setFormVisible(true);
    };

    const handleChange = (e) => {
        setApplicationData({ ...applicationData,[e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await axios.post('/management/job-applications/', {
                job: selectedJob.id,
                ...applicationData
            });
            toast.success(t('careers_page.form.success', 'Application submitted successfully'));
            setFormVisible(false);
            setApplicationData({ name: '', phone: '', email: '', cv_link: '', notes: '' });
            setSelectedJob(null);
        } catch (error) {
            toast.error(error.response?.data?.detail || t('errors.generic'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bg-secondary/30 min-h-screen pb-20">
            {/* Header */}
            <div className="bg-dark text-white py-12 md:py-16 text-center relative overflow-hidden">
                <div className={`absolute top-0 ${isRtl ? 'right-0' : 'left-0'} w-full h-full bg-primary/10`}></div>
                <div className="container mx-auto px-4 relative z-10">
                    <div className="bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20 shadow-lg">
                        <Briefcase size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl md:text-4xl font-black mb-3">{t('careers_page.title', 'Join Our Team')}</h1>
                    <p className="text-gray-300 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
                        {t('careers_page.desc', 'Discover exciting career opportunities and grow with us.')}
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 md:py-12 -mt-6 md:-mt-8 relative z-20">
                {/* Jobs Grid */}
                {loadingJobs ? (
                    <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
                        <p className="mt-4 text-gray-500 font-bold">{t('common.loading')}</p>
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="bg-white rounded-3xl p-10 md:p-16 text-center border border-dashed border-gray-200 shadow-sm">
                        <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                            <Briefcase size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-dark mb-2">{t('careers_page.no_positions', 'No open positions right now')}</h2>
                        <p className="text-gray-500 text-sm">{t('careers_page.follow_us', 'Follow us for new opportunities.')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {jobs.map(job => (
                            <div key={job.id} className="bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col h-full relative overflow-hidden group">
                                {/* Header */}
                                <div className="flex justify-between items-start mb-4 gap-2">
                                    <div>
                                        <h3 className="text-lg md:text-xl font-bold text-dark group-hover:text-primary transition-colors leading-tight mb-2">
                                            {job.title}
                                        </h3>
                                        <div className="flex flex-wrap gap-2 text-xs font-bold">
                                            <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-100">
                                                {getJobTypeLabel(job.job_type)}
                                            </span>
                                            <span className="bg-gray-50 text-gray-600 px-2.5 py-1 rounded-lg border border-gray-100 flex items-center gap-1">
                                                <MapPin size={12} /> {job.location}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 rounded-2xl bg-primary/5 text-primary flex items-center justify-center shrink-0">
                                        <Building2 size={20} />
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="space-y-2.5 mb-5">
                                    {job.salary_range && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                            <div className="bg-green-100 p-1.5 rounded-lg text-green-700 shrink-0">
                                                <DollarSign size={16}/>
                                            </div>
                                            <span className="font-bold">{t('careers_page.salary', 'Salary:')}</span>
                                            <span className="text-dark font-medium">{job.salary_range}</span>
                                        </div>
                                    )}
                                    {job.deadline && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                            <div className="bg-orange-100 p-1.5 rounded-lg text-orange-600 shrink-0">
                                                <Clock size={16}/>
                                            </div>
                                            <span className="font-bold">{t('careers_page.deadline', 'Deadline:')}</span>
                                            <span className="text-dark font-medium">{job.deadline}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Description & Requirements */}
                                <div className="mb-6 flex-grow">
                                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-3">
                                        {job.description}
                                    </p>

                                    {job.requirements && (
                                        <div className="bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100">
                                            <h4 className="text-xs font-bold text-dark mb-2 flex items-center gap-1.5">
                                                <CheckCircle2 size={14} className="text-primary"/>
                                                {t('careers_page.requirements', 'Requirements:')}
                                            </h4>
                                            <ul className="text-xs text-gray-600 space-y-1.5 ps-4 list-disc marker:text-primary">
                                                {job.requirements.split('\n').filter(r => r.trim()).slice(0, 3).map((req, i) => (
                                                    <li key={i} className="leading-snug">{req}</li>
                                                ))}
                                                {job.requirements.split('\n').filter(r => r.trim()).length > 3 && (
                                                    <li className="text-primary font-bold list-none -ms-4 mt-1">{t('careers_page.more_requirements', '+ More requirements')}</li>
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {/* Action */}
                                <div className="mt-auto pt-4 border-t border-gray-100">
                                    <button
                                        onClick={() => handleApplyClick(job)}
                                        className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-xl font-bold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                                    >
                                        {t('careers_page.apply_now', 'Apply Now')}
                                        {isRtl ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Application Modal */}
                <Modal
                    isOpen={formVisible}
                    onClose={() => setFormVisible(false)}
                    title={
                        <div className="flex items-center gap-2">
                            <Briefcase size={20} className="text-primary" />
                            <span>{t('careers_page.apply_modal_title', 'Job Application')}</span>
                        </div>
                    }
                    size="lg"
                >
                    {selectedJob && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl">
                                <h4 className="font-bold text-blue-900 mb-1">{t('careers_page.selected_job', 'Selected Job: ')} {selectedJob.title}</h4>
                                <p className="text-xs text-blue-700 m-0">{t('careers_page.form_hint', 'Please fill the data accurately to increase your chances.')}</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('careers_page.form.name', 'Full Name')} *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            required
                                            value={applicationData.name}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                                            placeholder={t('careers_page.form.name_placeholder', 'Your Full Name')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('careers_page.form.phone', 'Phone Number')} *</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            required
                                            value={applicationData.phone}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                                            placeholder="01xxxxxxxxx"
                                            dir="ltr"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('auth.email', 'Email (Optional)')}</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={applicationData.email}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                                        placeholder="example@mail.com"
                                        dir="ltr"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('careers_page.form.cv', 'CV Link')} *</label>
                                    <div className="relative">
                                        <input
                                            type="url"
                                            name="cv_link"
                                            required
                                            value={applicationData.cv_link}
                                            onChange={handleChange}
                                            className={`w-full h-12 ${isRtl ? 'pl-4 pr-10' : 'pr-4 pl-10'} rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm`}
                                            placeholder={t('careers_page.form.cv_placeholder', 'Link to Google Drive / LinkedIn')}
                                            dir="ltr"
                                        />
                                        <div className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${isRtl ? 'right-3' : 'left-3'}`}>
                                            <FileText size={18} />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1.5">{t('careers_page.form.cv_hint', 'Please ensure the link is publicly accessible.')}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('careers_page.form.notes_label', 'Additional Notes (About You)')}</label>
                                    <textarea
                                        rows="3"
                                        name="notes"
                                        value={applicationData.notes}
                                        onChange={handleChange}
                                        className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm resize-none"
                                        placeholder={t('careers_page.form.notes_placeholder', 'Write a short brief about your experience...')}
                                    />
                                </div>

                                <div className="pt-4 border-t border-gray-100 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormVisible(false)}
                                        className="flex-1 h-12 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex-[2] h-12 rounded-xl font-bold bg-primary hover:bg-primary-dark text-white shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                                    >
                                        {submitting ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                {t('careers_page.form.submit', 'Submit Application')}
                                                <Send size={18} className={isRtl ? '-scale-x-100' : ''} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </Modal>
            </div>
        </div>
    );
};

export default Careers;
