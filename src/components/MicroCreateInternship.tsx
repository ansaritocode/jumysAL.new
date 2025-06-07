import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs } from 'firebase/firestore';
import { MicroInternship, Badge } from '../types';
import { motion } from 'framer-motion';
import { FaBriefcase, FaGraduationCap, FaClock, FaStar, FaCheck, FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY || '');

const MicroCreateInternship: React.FC = () => {
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: [''],
    skills: [''],
    xpReward: 100,
    estimatedHours: 2,
    difficulty: 'beginner' as const,
    category: '',
    aiTechSpec: ''
  });
  const { t } = useTranslation();

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const badgesRef = collection(db, 'badges');
        const badgesSnapshot = await getDocs(badgesRef);
        const badgesData = badgesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Badge[];
        setBadges(badgesData);
      } catch (err) {
        console.error('Error fetching badges:', err);
        setError(t('errors.fetchBadges'));
      }
    };

    fetchBadges();
  }, [t]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleArrayInputChange = (index: number, value: string, field: 'requirements' | 'skills') => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const handleAddArrayItem = (field: 'requirements' | 'skills') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const handleRemoveArrayItem = (index: number, field: 'requirements' | 'skills') => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const generateTechSpec = async () => {
    if (!formData.title || !formData.description) {
      setError(t('errors.fillRequiredFields'));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

      const prompt = `Generate a detailed technical specification for a micro-internship with the following details:
        Title: ${formData.title}
        Description: ${formData.description}
        Requirements: ${formData.requirements.join(', ')}
        Skills: ${formData.skills.join(', ')}
        Difficulty: ${formData.difficulty}
        Estimated Hours: ${formData.estimatedHours}

        Please provide a structured technical specification that includes:
        1. Project Overview
        2. Technical Requirements
        3. Deliverables
        4. Evaluation Criteria
        5. Learning Objectives
        6. Timeline and Milestones`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const techSpec = response.text();

      setFormData(prev => ({
        ...prev,
        aiTechSpec: techSpec
      }));
    } catch (err) {
      console.error('Error generating tech spec:', err);
      setError(t('errors.generateTechSpec'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedBadge) return;

    try {
      setLoading(true);
      setError(null);

      // Get employer data
      const employerDoc = await getDoc(doc(db, 'users', user.uid));
      if (!employerDoc.exists()) {
        throw new Error(t('errors.employerNotFound'));
      }

      const employer = employerDoc.data();

      // Create micro-internship
      const internshipRef = await addDoc(collection(db, 'microInternships'), {
        ...formData,
        employerId: user.uid,
        employer: {
          id: user.uid,
          name: employer.displayName,
          company: employer.company,
          photoURL: employer.photoURL
        },
        badgeId: selectedBadge.id,
        badgeName: selectedBadge.name,
        badgeImageUrl: selectedBadge.imageUrl,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        createdAt: new Date(),
        status: 'active',
        applicationsCount: 0,
        completionsCount: 0
      });

      setSuccess(true);
      setTimeout(() => {
        window.location.href = `/micro-internships/${internshipRef.id}`;
      }, 1500);
    } catch (err) {
      console.error('Error creating micro-internship:', err);
      setError(t('errors.createInternship'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
      >
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {t('microInternship.create')}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('microInternship.title')}
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('microInternship.description')}
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('microInternship.requirements')}
            </label>
            {formData.requirements.map((req, index) => (
              <div key={index} className="flex items-center space-x-2 mb-2">
                <input
                  type="text"
                  value={req}
                  onChange={(e) => handleArrayInputChange(index, e.target.value, 'requirements')}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => handleRemoveArrayItem(index, 'requirements')}
                  className="p-2 text-red-500 hover:text-red-600"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => handleAddArrayItem('requirements')}
              className="mt-2 text-blue-500 hover:text-blue-600"
            >
              + {t('microInternship.addRequirement')}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('microInternship.skills')}
            </label>
            {formData.skills.map((skill, index) => (
              <div key={index} className="flex items-center space-x-2 mb-2">
                <input
                  type="text"
                  value={skill}
                  onChange={(e) => handleArrayInputChange(index, e.target.value, 'skills')}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => handleRemoveArrayItem(index, 'skills')}
                  className="p-2 text-red-500 hover:text-red-600"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => handleAddArrayItem('skills')}
              className="mt-2 text-blue-500 hover:text-blue-600"
            >
              + {t('microInternship.addSkill')}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('microInternship.xpReward')}
              </label>
              <input
                type="number"
                name="xpReward"
                value={formData.xpReward}
                onChange={handleInputChange}
                min="0"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('microInternship.estimatedHours')}
              </label>
              <input
                type="number"
                name="estimatedHours"
                value={formData.estimatedHours}
                onChange={handleInputChange}
                min="1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('microInternship.difficulty')}
              </label>
              <select
                name="difficulty"
                value={formData.difficulty}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                required
              >
                <option value="beginner">{t('difficulty.beginner')}</option>
                <option value="intermediate">{t('difficulty.intermediate')}</option>
                <option value="advanced">{t('difficulty.advanced')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('microInternship.category')}
              </label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('microInternship.badge')}
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  onClick={() => setSelectedBadge(badge)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedBadge?.id === badge.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-700 hover:border-blue-500'
                  }`}
                >
                  <img
                    src={badge.imageUrl}
                    alt={badge.name}
                    className="w-16 h-16 mx-auto mb-2"
                  />
                  <p className="text-sm text-center text-gray-900 dark:text-white">
                    {badge.name}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={generateTechSpec}
              disabled={loading}
              className="w-full px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  {t('common.loading')}
                </div>
              ) : (
                t('microInternship.generateTechSpec')
              )}
            </button>
          </div>

          {formData.aiTechSpec && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('microInternship.techSpec')}
              </label>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-md">
                <pre className="whitespace-pre-wrap text-sm text-gray-900 dark:text-white">
                  {formData.aiTechSpec}
                </pre>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-md">
              <div className="flex items-center text-red-600 dark:text-red-400">
                <FaTimes className="mr-2" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-md">
              <div className="flex items-center text-green-600 dark:text-green-400">
                <FaCheck className="mr-2" />
                <span>{t('microInternship.created')}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !selectedBadge}
              className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  {t('common.loading')}
                </div>
              ) : (
                t('microInternship.create')
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default MicroCreateInternship; 