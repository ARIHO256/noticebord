import { api } from './client';
import type { FriendRequest } from './friends';

export type NotificationType = 'friend_request' | 'notice' | 'suspended_post' | 'comment' | 'like';

export type Notification = {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  avatar?: string | null;
  created_at: string;
  read: boolean;
  // For friend requests
  friend_request?: FriendRequest;
  // For notices
  notice_id?: number;
  notice_title?: string;
  notice_author?: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string | null;
    designation?: string;
  };
};

// This will be a combined endpoint that returns all notifications
// For now, we'll combine friend requests and notices manually
export const fetchNotifications = async (): Promise<Notification[]> => {
  // Fetch friend requests
  const friendRequestsResponse = await api.get<FriendRequest[]>('/users/friend-requests/', {
    params: { box: 'incoming' },
  });
  const friendRequests = Array.isArray(friendRequestsResponse.data)
    ? friendRequestsResponse.data
    : friendRequestsResponse.data?.results || [];

  // Fetch current user profile to get school and department
  const userProfileResponse = await api.get('/users/profiles/me/');
  const userProfile = userProfileResponse.data;
  const userSchool = userProfile?.school;
  const userDepartment = userProfile?.department;
  const isStudent = !userProfile?.is_staff && !userProfile?.is_faculty;

  // Fetch notices from staff/faculty (VC, Dean, HOD, etc.)
  // For regular students: Use the official endpoint which handles department/school filtering correctly
  // For staff/faculty: Show all notices (including from other staff/faculty)
  let noticesResponse;
  
  if (isStudent) {
    // For students, use the official endpoint which properly handles:
    // - Cross-cutting departments (VC, Registrar, etc.) → all students
    // - HOD notices → only students in that department
    // - Dean notices → only students in that school
    noticesResponse = await api.get('/notices/official/', {
      params: {
        ordering: '-created_at',
        page_size: 50,
      },
    });
  } else {
    // For staff/faculty users, fetch all staff/faculty notices
    const noticeParams: Record<string, any> = {
      ordering: '-created_at',
      page_size: 50,
      created_by__is_staff: true,
    };
    noticesResponse = await api.get('/notices/', { params: noticeParams });
  }
  const notices = Array.isArray(noticesResponse.data)
    ? noticesResponse.data
    : noticesResponse.data?.results || [];

  // Additional client-side filter to ensure no student posts slip through
  // Filter out any notices that might have been created by students
  const filteredNotices = notices.filter((notice: any) => {
    // Only include notices from staff or faculty
    return notice.created_by_is_staff === true || notice.created_by_is_faculty === true;
  });

  // Transform friend requests to notifications
  const friendRequestNotifications: Notification[] = friendRequests.map((req) => ({
    id: req.id,
    type: 'friend_request' as NotificationType,
    title: 'Friend Request',
    message: `${req.sender.first_name || req.sender.username} sent you a friend request`,
    avatar: req.sender.avatar_url,
    created_at: req.created_at,
    read: false,
    friend_request: req,
  }));

  // Transform notices to notifications (using filtered notices)
  const noticeNotifications: Notification[] = filteredNotices.map((notice: any) => {
    const authorName = notice.created_by_full_name || notice.created_by_username;
    const designation = notice.created_by_designation || '';
    const noticeDepartment = notice.department || '';
    let message = '';
    
    // Build message based on designation and department
    if (designation === 'Vice Chancellor' || designation === 'VC') {
      message = `Vice Chancellor ${authorName} posted a notice`;
    } else if (designation === 'Dean') {
      message = `Dean ${authorName} posted a notice`;
    } else if (designation === 'HOD' || designation === 'Head of Department') {
      if (noticeDepartment) {
        message = `HOD ${authorName} from ${noticeDepartment} posted a notice`;
      } else {
        message = `HOD ${authorName} posted a notice`;
      }
    } else if (notice.created_by_is_staff || notice.created_by_is_faculty) {
      if (noticeDepartment) {
        message = `${authorName} from ${noticeDepartment} posted a notice`;
      } else {
        message = `${authorName} posted a notice`;
      }
    } else {
      message = `${authorName} posted a notice`;
    }

    return {
      id: notice.id + 1000000, // Offset to avoid conflicts with friend request IDs
      type: 'notice' as NotificationType,
      title: notice.title || 'New Notice',
      message,
      avatar: notice.created_by_avatar,
      created_at: notice.created_at,
      read: false,
      notice_id: notice.id,
      notice_title: notice.title,
      notice_author: {
        id: notice.created_by,
        username: notice.created_by_username,
        first_name: notice.created_by_full_name?.split(' ')[0],
        last_name: notice.created_by_full_name?.split(' ').slice(1).join(' '),
        avatar_url: notice.created_by_avatar,
        designation: designation,
      },
    };
  });

  // Check for suspended posts notifications
  // For admin/staff: fetch ALL suspended posts (they should see them as notifications)
  // For regular users: fetch only their own suspended posts
  try {
    const isAdminOrStaff = userProfile?.is_staff || userProfile?.is_superuser;
    let suspendedNotices: any[] = [];
    
    if (isAdminOrStaff) {
      // Admin/staff: fetch all suspended posts
      const suspendedResponse = await api.get('/notices/', {
        params: {
          is_active: false,
          ordering: '-updated_at',
          page_size: 50,
        },
      });
      suspendedNotices = Array.isArray(suspendedResponse.data)
        ? suspendedResponse.data
        : suspendedResponse.data?.results || [];
    } else {
      // Regular users: fetch only their own suspended posts
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const myNoticesResponse = await api.get('/notices/', {
        params: {
          created_by: userProfile.id,
          ordering: '-created_at',
          page_size: 20,
        },
      });
      const myNotices = Array.isArray(myNoticesResponse.data)
        ? myNoticesResponse.data
        : myNoticesResponse.data?.results || [];
      
      // Filter to only recently suspended posts (within last 24 hours)
      suspendedNotices = myNotices.filter((notice: any) => {
        if (!notice.suspension_reason || notice.is_active) return false;
        const noticeDate = new Date(notice.updated_at || notice.created_at);
        return noticeDate >= yesterday;
      });
    }
    
    // Create notifications for suspended posts
    const suspendedPostNotifications: Notification[] = suspendedNotices.map((notice: any) => {
      const authorName = notice.created_by_full_name || notice.created_by_username || 'Unknown';
      const isOwnPost = notice.created_by === userProfile.id;
      
      return {
        id: notice.id + 2000000, // Offset to avoid conflicts
        type: 'suspended_post' as NotificationType,
        title: isOwnPost ? 'Post Suspended' : 'Suspended Post',
        message: isOwnPost
          ? `Your post "${notice.title}" has been suspended due to: ${notice.suspension_reason}`
          : `Post "${notice.title}" by ${authorName} has been suspended due to: ${notice.suspension_reason}`,
        avatar: notice.created_by_avatar || null,
        created_at: notice.updated_at || notice.created_at,
        read: false,
        notice_id: notice.id,
        notice_title: notice.title,
        notice_author: {
          id: notice.created_by,
          username: notice.created_by_username,
          first_name: notice.created_by_full_name?.split(' ')[0],
          last_name: notice.created_by_full_name?.split(' ').slice(1).join(' '),
          avatar_url: notice.created_by_avatar,
          designation: notice.created_by_designation,
        },
      };
    });
    
    // Combine all notifications
    const allNotifications = [
      ...friendRequestNotifications,
      ...noticeNotifications,
      ...suspendedPostNotifications,
    ].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    
    return allNotifications;
  } catch (error) {
    // If fetching suspended notices fails, just return the regular notifications
    console.warn('Failed to fetch suspended notices:', error);
    const allNotifications = [...friendRequestNotifications, ...noticeNotifications].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return allNotifications;
  }
};

export const markNotificationAsRead = async (notificationId: number) => {
  // This would be implemented when backend supports it
  // For now, just return success
  return Promise.resolve();
};

export const getUnreadNotificationCount = async (): Promise<number> => {
  try {
    const notifications = await fetchNotifications();
    return notifications.filter((notif) => !notif.read).length;
  } catch (error) {
    console.error('Error fetching unread notification count:', error);
    return 0;
  }
};
