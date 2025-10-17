import { format, parseISO, formatDistanceToNow } from 'date-fns';

export const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';

  try {
    const date = parseISO(dateString);
    return format(date, 'MMM dd, yyyy h:mm a');
  } catch (error) {
    console.error('Error formatting date:', error);
    return '-';
  }
};

export const formatDateTimeShort = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';

  try {
    const date = parseISO(dateString);
    return format(date, 'MMM dd, yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return '-';
  }
};

export const formatDateTimeCompact = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';

  try {
    const date = parseISO(dateString);
    return format(date, 'yyyy-MM-dd HH:mm');
  } catch (error) {
    console.error('Error formatting date:', error);
    return '-';
  }
};

export const formatRelativeTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';

  try {
    const date = parseISO(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return '-';
  }
};

export const formatDateForInput = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

export const getLocalTimezoneOffset = (): string => {
  const offset = -new Date().getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  const sign = offset >= 0 ? '+' : '-';
  return `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const getLocalTimezoneAbbreviation = (): string => {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const date = new Date();
    const shortFormat = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    }).format(date);

    const parts = shortFormat.split(' ');
    return parts[parts.length - 1];
  } catch (error) {
    return getLocalTimezoneOffset();
  }
};

export const formatDateTimeWithTimezone = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';

  try {
    const date = parseISO(dateString);
    const formattedDate = format(date, 'MMM dd, yyyy h:mm a');
    const timezone = getLocalTimezoneAbbreviation();
    return `${formattedDate} ${timezone}`;
  } catch (error) {
    console.error('Error formatting date with timezone:', error);
    return '-';
  }
};

export const formatUTCDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';

  try {
    const date = parseISO(dateString);
    return format(date, "MMM dd, yyyy h:mm a 'UTC'");
  } catch (error) {
    console.error('Error formatting UTC date:', error);
    return '-';
  }
};
