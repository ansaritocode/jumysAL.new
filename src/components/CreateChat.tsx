import React, { useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Post, UserData } from '../types';
import { motion } from 'framer-motion';
import { FaEnvelope, FaCheck, FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

interface CreateChatProps {
  post: Post;
  onClose: () => void;
  recipientId?: string;
  postId?: string;
  postTitle?: string;
  initiateButtonText?: string;
  buttonClassName?: string;
}

const CreateChat: React.FC<CreateChatProps> = ({ 
  post, 
  onClose, 
  recipientId, 
  postId, 
  postTitle, 
  initiateButtonText = 'Start Chat', 
  buttonClassName = 'px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600' 
}) => {
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { t } = useTranslation();

  const handleCreateChat = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Get employer data
      const employerDoc = await getDoc(doc(db, 'users', post.userId!));
      if (!employerDoc.exists()) {
        throw new Error(t('errors.employerNotFound'));
      }

      const employer = employerDoc.data() as UserData;

      // Create chat
      const chatRef = await addDoc(collection(db, 'chats'), {
        participants: [user.uid, post.userId],
        postId: post.id,
        createdAt: new Date(),
        lastMessage: null,
        unreadCount: {
          [user.uid]: 0,
          [post.userId!]: 1
        }
      });

      // Add initial message
      await addDoc(collection(db, `chats/${chatRef.id}/messages`), {
        text: t('chat.initialMessage', { postTitle: post.title }),
        senderId: user.uid,
        timestamp: new Date(),
        read: false
      });

      // Update last message
      await updateDoc(doc(db, 'chats', chatRef.id), {
        lastMessage: {
          text: t('chat.initialMessage', { postTitle: post.title }),
          senderId: user.uid,
          timestamp: new Date()
        }
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
        window.location.href = `/chat/${chatRef.id}`;
      }, 1500);
    } catch (err) {
      console.error('Error creating chat:', err);
      setError(t('errors.createChat'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('chat.create')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-gray-600 dark:text-gray-300">
            {t('chat.createDescription')}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-md">
            <div className="flex items-center text-red-600 dark:text-red-400">
              <FaTimes className="mr-2" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-md">
            <div className="flex items-center text-green-600 dark:text-green-400">
              <FaCheck className="mr-2" />
              <span>{t('chat.created')}</span>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
            disabled={loading}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleCreateChat}
            disabled={loading}
            className={buttonClassName}
          >
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                {t('common.loading')}
              </div>
            ) : (
              <div className="flex items-center">
                <FaEnvelope className="mr-2" />
                {initiateButtonText}
              </div>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CreateChat; 