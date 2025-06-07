import React, { useState, useEffect, useCallback, Component, ErrorInfo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, doc, getDoc, setDoc, deleteDoc, Firestore, limit, updateDoc, arrayUnion, arrayRemove, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Post, UserData } from '../types';
import CreateChat from './CreateChat';
import { motion } from 'framer-motion';
import { FaBriefcase, FaMapMarkerAlt, FaClock, FaMoneyBillWave, FaStar, FaBookmark, FaBookmark as FaBookmarkSolid } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

// Demo employer ID that will be used for all demo jobs
const DEMO_EMPLOYER_ID = 'demo-employer-official';

// Function to ensure demo employer exists in Firebase
const ensureDemoEmployerExists = async () => {
  try {
    const demoEmployerRef = doc(db, 'users', DEMO_EMPLOYER_ID);
    const demoEmployerDoc = await getDoc(demoEmployerRef);
    
    if (!demoEmployerDoc.exists()) {
      console.log("Creating demo employer account");
      await setDoc(demoEmployerRef, {
        displayName: "Demo Employer",
        email: "demo@jumys.al",
        photoURL: "/images/default-avatar.jpg",
        role: "employer",
        createdAt: new Date(),
        isVerified: true
      });
      console.log("Demo employer created successfully");
    } else {
      console.log("Demo employer already exists");
    }
    
    return DEMO_EMPLOYER_ID;
  } catch (error) {
    console.error("Error ensuring demo employer exists:", error);
    return null;
  }
};

// Simple hardcoded demo data to ensure we always have something to display
const DEMO_JOBS = [
  {
    id: 'demo-job-1',
    title: 'Frontend Developer',
    description: 'We are looking for a frontend developer with React experience',
    companyName: 'TechCorp',
    location: 'Алматы',
    employmentType: 'Полная занятость',
    experience: '1-3 года',
    salary: '150,000 - 300,000 ₸',
    createdAt: new Date(),
    type: 'job',
    userId: DEMO_EMPLOYER_ID
  },
  {
    id: 'demo-job-2',
    title: 'Backend Developer',
    description: 'Required Node.js developer with experience in building RESTful APIs',
    companyName: 'Digital Solutions',
    location: 'Астана',
    employmentType: 'Полная занятость',
    experience: '2-5 лет',
    salary: '200,000 - 350,000 ₸',
    createdAt: new Date(),
    type: 'job',
    userId: DEMO_EMPLOYER_ID
  },
  {
    id: 'demo-job-3',
    title: 'UX/UI Designer',
    description: 'Creative designer to work on our mobile application',
    companyName: 'CreativeMinds',
    location: 'Удаленно',
    employmentType: 'Частичная занятость',
    experience: '1-3 года',
    salary: '180,000 - 250,000 ₸',
    createdAt: new Date(),
    type: 'job',
    userId: DEMO_EMPLOYER_ID
  },
  {
    id: 'demo-job-4',
    title: 'DevOps Engineer',
    description: 'Setting up and maintaining CI/CD pipelines for our products',
    companyName: 'CloudTech',
    location: 'Алматы',
    employmentType: 'Полная занятость',
    experience: '3-5 лет',
    salary: '300,000 - 450,000 ₸',
    createdAt: new Date(),
    type: 'job',
    userId: DEMO_EMPLOYER_ID
  },
  {
    id: 'demo-job-5',
    title: 'Product Manager',
    description: 'Lead the development of our new fintech product',
    companyName: 'FinInnovate',
    location: 'Астана',
    employmentType: 'Полная занятость',
    experience: '5+ лет',
    salary: '400,000 - 600,000 ₸',
    createdAt: new Date(),
    type: 'job',
    userId: DEMO_EMPLOYER_ID
  }
];

// Simple failsafe fallback component
const JobFallback = () => (
  <div className="relative min-h-screen bg-gray-50 dark:bg-dark overflow-hidden pt-16">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="bg-white dark:bg-dark-lighter rounded-xl shadow-card p-6 text-center">
        <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
          Не удалось загрузить вакансии
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Произошла ошибка при загрузке данных. Пожалуйста, перезагрузите страницу или попробуйте позже.
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
        >
          Перезагрузить страницу
        </button>
      </div>
    </div>
  </div>
);

// Error boundary to catch runtime errors
class JobsErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean, errorMessage: string}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
    console.log("JobsErrorBoundary initialized");
  }

  static getDerivedStateFromError(error: Error) {
    console.error("Error caught in JobsErrorBoundary:", error);
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught in componentDidCatch:", error);
    console.error("Error info:", errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-lighter rounded-xl shadow-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-center text-gray-900 dark:text-white mb-2">Произошла ошибка</h2>
            <p className="text-gray-600 dark:text-gray-300 text-center mb-4">
              Не удалось загрузить страницу вакансий.
            </p>
            {this.state.errorMessage && (
              <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-lg mb-4 text-sm text-red-700 dark:text-red-300">
                <p className="font-medium">Детали ошибки:</p>
                <p className="mt-1">{this.state.errorMessage}</p>
              </div>
            )}
            <div className="flex justify-center">
              <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Попробовать снова
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Simple function to check Firebase connectivity
const checkFirebaseConnection = async () => {
  console.log("Checking Firebase connection...");
  try {
    // Try to access a small collection or document that should always exist
    const testQuery = query(collection(db, "posts"), limit(1));
    console.log("Created test query for posts collection");
    
    try {
      const querySnapshot = await getDocs(testQuery);
      console.log("Firebase connection check result:", { 
        connected: true, 
        docs: querySnapshot.size,
        empty: querySnapshot.empty
      });
      return true;
    } catch (queryError) {
      console.error("Firebase query execution failed:", queryError);
      return false;
    }
  } catch (error) {
    console.error("Firebase connection check failed with error:", error);
    // Try to provide more specific error information
    if (error instanceof Error) {
      console.error("Error name:", error.name, "Error message:", error.message);
    }
    return false;
  }
};

// At the very beginning of the file, right after the imports
console.log("📂 Jobs.tsx module loading");

// Add this function to create an absolute minimal component
const createMinimalJobsList = () => {
  console.log("Creating minimal jobs fallback");
  return (
    <div className="p-4 m-4 bg-white dark:bg-gray-800 rounded shadow">
      <h1 className="text-2xl mb-4">Вакансии</h1>
      <p className="text-lg mb-4">Демо-данные для отладки:</p>
      <ul className="list-disc pl-5">
        {DEMO_JOBS.map(job => (
          <li key={job.id} className="mb-2">
            <strong>{job.title}</strong> - {job.companyName} ({job.location})
          </li>
        ))}
      </ul>
      <p className="mt-4 text-red-500">Страница отображается в аварийном режиме</p>
    </div>
  );
};

// Fallback function to fetch jobs directly using Firebase REST API
const fetchJobsDirectly = async (): Promise<Post[] | null> => {
  try {
    console.log("Attempting to fetch jobs via direct REST API call...");
    const projectId = "jumysal-a5ce4"; // Your Firebase project ID
    const apiKey = "AIzaSyBFrDVlsCR8dDChhNr1bly5qvxC-tnzEhU"; // Your Firebase API key
    
    // Construct the Firebase REST API URL for querying the collection
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/posts?key=${apiKey}`;
    
    console.log("Sending REST API request to Firebase...");
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("Firebase REST API request failed:", response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    console.log("Firebase REST API response received:", data);
    
    if (!data.documents || !data.documents.length) {
      console.log("No documents found in REST API response");
      return null;
    }
    
    // Transform Firestore REST API response format to our Post format
    const jobs = data.documents
      .map((doc: any) => {
        // Extract the document ID from the name path
        const id = doc.name.split('/').pop();
        
        // Extract fields and convert from Firestore value format
        const fields: any = {};
        Object.entries(doc.fields || {}).forEach(([key, value]: [string, any]) => {
          // Handle different Firestore value types
          if (value.stringValue !== undefined) fields[key] = value.stringValue;
          else if (value.booleanValue !== undefined) fields[key] = value.booleanValue;
          else if (value.integerValue !== undefined) fields[key] = parseInt(value.integerValue);
          else if (value.doubleValue !== undefined) fields[key] = value.doubleValue;
          else if (value.timestampValue !== undefined) fields[key] = new Date(value.timestampValue);
          else if (value.arrayValue !== undefined) {
            fields[key] = value.arrayValue.values?.map((v: any) => {
              return v.stringValue || v.integerValue || v.booleanValue || v.doubleValue;
            }) || [];
          }
          // Add more type handling as needed
        });
        
        return { id, ...fields } as Post;
      })
      .filter((post: any) => post.type === 'job'); // Filter to only include job posts
    
    console.log("Successfully parsed jobs from REST API:", jobs.length);
    return jobs.length > 0 ? jobs : null;
  } catch (error) {
    console.error("Error in direct jobs fetch:", error);
    return null;
  }
};

// Функция для преобразования типа
const ensurePostType = (post: any): Post => {
  return {
    id: post.id,
    title: post.title || 'Без названия',
    description: post.description || '',
    companyName: post.companyName || 'Неизвестная компания',
    location: post.location || 'Не указано',
    employmentType: post.employmentType || post.employment || 'Не указано',
    experience: post.experience || post.experienceLevel || 'Не указано',
    salary: post.salary || 'Не указано',
    createdAt: post.createdAt || new Date(),
    type: post.type || 'job', // Default to job type
    userId: post.authorId || post.userId || DEMO_EMPLOYER_ID, // Ensure userId is set
    ...post // Preserve all other properties
  };
};

const Jobs: React.FC = () => {
  const [user] = useAuthState(auth);
  const [jobs, setJobs] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Post | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get all jobs
        const jobsRef = collection(db, 'posts');
        const jobsQuery = query(jobsRef, where('status', '==', 'active'));
        const jobsSnapshot = await getDocs(jobsQuery);
        
        const jobsData = jobsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Post[];

        // Get employer data for each job
        const jobsWithEmployers = await Promise.all(
          jobsData.map(async (job) => {
            if (job.userId) {
              const employerDoc = await getDoc(doc(db, 'users', job.userId));
              if (employerDoc.exists()) {
                const employer = employerDoc.data() as UserData;
                return {
                  ...job,
                  user: {
                    id: employer.uid,
                    displayName: employer.displayName,
                    photoURL: employer.photoURL
                  }
                };
              }
            }
            return job;
          })
        );

        setJobs(jobsWithEmployers);

        // Get saved jobs if user is logged in
        if (user) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserData;
            setSavedJobs(userData.savedPosts || []);
          }
        }
      } catch (err) {
        console.error('Error fetching jobs:', err);
        setError(t('errors.fetchJobs'));
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [user, t]);

  const handleSaveJob = async (jobId: string) => {
    if (!user) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      const isSaved = savedJobs.includes(jobId);

      if (isSaved) {
        await updateDoc(userRef, {
          savedPosts: arrayRemove(jobId)
        });
        setSavedJobs(prev => prev.filter(id => id !== jobId));
      } else {
        await updateDoc(userRef, {
          savedPosts: arrayUnion(jobId)
        });
        setSavedJobs(prev => [...prev, jobId]);
      }
    } catch (err) {
      console.error('Error saving job:', err);
      setError(t('errors.saveJob'));
    }
  };

  const handleContact = (job: Post) => {
    setSelectedJob(job);
    setShowChatModal(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center p-4">
        {error}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center p-4 text-gray-500">
        {t('noJobs')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <motion.div
          key={job.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                {job.companyLogo ? (
                  <img
                    src={job.companyLogo}
                    alt={job.companyName}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <FaBriefcase className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {job.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {job.companyName}
                </p>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center">
                    <FaMapMarkerAlt className="mr-1" />
                    <span>{job.location}</span>
                  </div>
                  <div className="flex items-center">
                    <FaClock className="mr-1" />
                    <span>{job.employmentType}</span>
                  </div>
                  <div className="flex items-center">
                    <FaMoneyBillWave className="mr-1" />
                    <span>{job.salary}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {user && (
                <button
                  onClick={() => handleSaveJob(job.id)}
                  className="p-2 text-gray-400 hover:text-yellow-500 transition-colors"
                >
                  {savedJobs.includes(job.id) ? (
                    <FaBookmarkSolid className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <FaBookmark className="w-5 h-5" />
                  )}
                </button>
              )}
              <button
                onClick={() => handleContact(job)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                {t('contact')}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-gray-600 dark:text-gray-300">
              {job.description}
            </p>
          </div>

          {job.skills && job.skills.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('skills')}
              </h4>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded-full text-sm"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      ))}

      {showChatModal && selectedJob && (
        <CreateChat
          post={selectedJob}
          onClose={() => {
            setShowChatModal(false);
            setSelectedJob(null);
          }}
        />
      )}
    </div>
  );
};

// At the bottom of the file, modify the export
export default function JobsWithErrorBoundary() {
  console.log("JobsWithErrorBoundary rendering");
  
  // Absolute fallback in case the ErrorBoundary itself fails
  try {
    return (
      <JobsErrorBoundary>
        <Jobs />
      </JobsErrorBoundary>
    );
  } catch (criticalError) {
    console.error("Critical error in Jobs error boundary:", criticalError);
    // Return an absolute minimal component
    return createMinimalJobsList();
  }
}; 