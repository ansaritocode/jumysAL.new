import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import { collection, getDocs, query, where, doc, setDoc, updateDoc } from 'firebase/firestore';
import { UserData, Post } from '../types';
import { motion } from 'framer-motion';
import { FaUser, FaGraduationCap, FaBriefcase, FaStar, FaEnvelope, FaCheck } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

interface MatchedStudent extends UserData {
  matchScore: number;
  matchReasons: string[];
}

const AIMatchStudents: React.FC<{ post: Post }> = ({ post }) => {
  const [user] = useAuthState(auth);
  const [matchedStudents, setMatchedStudents] = useState<MatchedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<MatchedStudent | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const fetchMatchedStudents = async () => {
      if (!user || !post) return;

      try {
        setLoading(true);
        setError(null);

        // Get all students
        const studentsRef = collection(db, 'users');
        const studentsQuery = query(studentsRef, where('role', '==', 'student'));
        const studentsSnapshot = await getDocs(studentsQuery);
        
        const students = studentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UserData[];

        // Calculate match scores for each student
        const matched = students.map(student => {
          const matchScore = calculateMatchScore(student, post);
          const matchReasons = generateMatchReasons(student, post, matchScore);
          return { ...student, matchScore, matchReasons };
        });

        // Sort by match score and filter out low matches
        const sortedMatches = matched
          .filter(match => match.matchScore > 0.3)
          .sort((a, b) => b.matchScore - a.matchScore);

        setMatchedStudents(sortedMatches);
      } catch (err) {
        console.error('Error fetching matched students:', err);
        setError(t('errors.fetchStudents'));
      } finally {
        setLoading(false);
      }
    };

    fetchMatchedStudents();
  }, [user, post, t]);

  const calculateMatchScore = (student: UserData, post: Post): number => {
    let score = 0;
    let totalFactors = 0;

    // Skills match (40% weight)
    if (student.skills && post.skills) {
      const matchingSkills = student.skills.filter(skill => 
        post.skills.some(postSkill => 
          postSkill.toLowerCase().includes(skill.toLowerCase())
        )
      );
      score += (matchingSkills.length / post.skills.length) * 0.4;
      totalFactors += 0.4;
    }

    // Experience match (30% weight)
    if (student.experience && post.experience) {
      const studentExp = parseInt(student.experience) || 0;
      const postExp = parseInt(post.experience) || 0;
      if (studentExp >= postExp) {
        score += 0.3;
      } else {
        score += (studentExp / postExp) * 0.3;
      }
      totalFactors += 0.3;
    }

    // Education match (20% weight)
    if (student.education && post.preferredUniversities) {
      const hasMatchingEducation = post.preferredUniversities.some(uni =>
        student.education.toLowerCase().includes(uni.toLowerCase())
      );
      score += (hasMatchingEducation ? 1 : 0.5) * 0.2;
      totalFactors += 0.2;
    }

    // Location match (10% weight)
    if (student.location && post.location) {
      const locationMatch = student.location.toLowerCase() === post.location.toLowerCase();
      score += (locationMatch ? 1 : 0.5) * 0.1;
      totalFactors += 0.1;
    }

    return totalFactors > 0 ? score / totalFactors : 0;
  };

  const generateMatchReasons = (student: UserData, post: Post, score: number): string[] => {
    const reasons: string[] = [];

    // Skills match reasons
    if (student.skills && post.skills) {
      const matchingSkills = student.skills.filter(skill =>
        post.skills.some(postSkill =>
          postSkill.toLowerCase().includes(skill.toLowerCase())
        )
      );
      if (matchingSkills.length > 0) {
        reasons.push(t('matchReasons.skills', { count: matchingSkills.length }));
      }
    }

    // Experience match reasons
    if (student.experience && post.experience) {
      const studentExp = parseInt(student.experience) || 0;
      const postExp = parseInt(post.experience) || 0;
      if (studentExp >= postExp) {
        reasons.push(t('matchReasons.experience'));
      }
    }

    // Education match reasons
    if (student.education && post.preferredUniversities) {
      const hasMatchingEducation = post.preferredUniversities.some(uni =>
        student.education.toLowerCase().includes(uni.toLowerCase())
      );
      if (hasMatchingEducation) {
        reasons.push(t('matchReasons.education'));
      }
    }

    return reasons;
  };

  const handleContact = async (student: MatchedStudent) => {
    if (!user || !post) return;

    try {
      setLoading(true);
      setError(null);

      // Create chat document
      const chatRef = doc(collection(db, 'chats'));
      await setDoc(chatRef, {
        participants: [user.uid, student.uid],
        postId: post.id,
        postTitle: post.title,
        createdAt: new Date(),
        lastMessage: {
          text: `Hi ${student.displayName}, I'm interested in your profile for the ${post.title} position.`,
          senderId: user.uid,
          timestamp: new Date()
        },
        unreadCount: {
          [student.uid]: 1,
          [user.uid]: 0
        }
      });

      // Update last message in chat document
      await updateDoc(chatRef, {
        lastMessage: {
          text: `Hi ${student.displayName}, I'm interested in your profile for the ${post.title} position.`,
          senderId: user.uid,
          timestamp: new Date()
        }
      });

      // Update unread count
      await updateDoc(chatRef, {
        unreadCount: {
          [student.uid]: 1,
          [user.uid]: 0
        }
      });

      setSelectedStudent(student);
    } catch (err) {
      console.error('Error creating chat:', err);
      setError(t('errors.createChat'));
    } finally {
      setLoading(false);
    }
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

  if (matchedStudents.length === 0) {
    return (
      <div className="text-center p-4 text-gray-500">
        {t('noMatches')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {matchedStudents.map((student) => (
        <motion.div
          key={student.uid}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                {student.photoURL ? (
                  <img
                    src={student.photoURL}
                    alt={student.displayName}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <FaUser className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {student.displayName}
                </h3>
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <FaGraduationCap />
                  <span>{student.education}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <FaBriefcase />
                  <span>{student.experience} {t('yearsExperience')}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                <FaStar className="text-yellow-400 w-5 h-5" />
                <span className="ml-1 text-lg font-semibold">
                  {Math.round(student.matchScore * 100)}%
                </span>
              </div>
              <button
                onClick={() => handleContact(student)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                <FaEnvelope className="inline-block mr-2" />
                {t('contact')}
              </button>
            </div>
          </div>
          
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('matchReasons.title')}
            </h4>
            <div className="flex flex-wrap gap-2">
              {student.matchReasons.map((reason, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 rounded-full text-sm"
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>

          {selectedStudent?.uid === student.uid && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-md"
            >
              <div className="flex items-center text-green-600 dark:text-green-400">
                <FaCheck className="mr-2" />
                <span>{t('chat.created')}</span>
              </div>
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  );
};

export default AIMatchStudents; 
