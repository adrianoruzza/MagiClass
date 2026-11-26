import { Subject, LinkedSubjectGroup } from '../types';

/**
 * Returns all subject names that belong to the same linked group as the given subject name.
 * If the subject is not part of any group, returns an array containing only the given subject name.
 */
export const getMatchingSubjectNames = (
  subjectName: string,
  subjects: Subject[],
  linkedSubjectGroups: LinkedSubjectGroup[] = []
): string[] => {
  if (!subjectName) return [];
  const normalized = subjectName.trim().toLowerCase();
  
  // Find subject entity by name
  const currentSubj = subjects.find(s => s.name.trim().toLowerCase() === normalized);
  if (!currentSubj) {
    return [subjectName];
  }

  // Find all groups that contain this subject's ID
  const matchingGroups = (linkedSubjectGroups || []).filter(
    g => g.subjectIds && g.subjectIds.includes(currentSubj.id)
  );

  if (matchingGroups.length === 0) {
    return [currentSubj.name];
  }

  // Collect all unique subject IDs from matching groups
  const allSubjectIds = new Set<string>();
  matchingGroups.forEach(g => {
    if (Array.isArray(g.subjectIds)) {
      g.subjectIds.forEach(id => allSubjectIds.add(id));
    }
  });

  // Map IDs to actual subject names
  const matchingSubjects = subjects.filter(s => allSubjectIds.has(s.id));
  const names = matchingSubjects.map(s => s.name);

  // Ensure current subject name is always present
  if (!names.some(n => n.trim().toLowerCase() === normalized)) {
    names.push(currentSubj.name);
  }

  return names;
};

/**
 * Returns the linked group that contains the given subject ID, if any.
 */
export const getLinkedGroupForSubject = (
  subjectId: string,
  linkedSubjectGroups: LinkedSubjectGroup[] = []
): LinkedSubjectGroup | undefined => {
  return linkedSubjectGroups.find(g => g.subjectIds && g.subjectIds.includes(subjectId));
};

/**
 * Returns the names of other subjects linked to the given subject ID.
 */
export const getOtherLinkedSubjectNames = (
  subjectId: string,
  subjects: Subject[],
  linkedSubjectGroups: LinkedSubjectGroup[] = []
): string[] => {
  const group = getLinkedGroupForSubject(subjectId, linkedSubjectGroups);
  if (!group || !group.subjectIds) return [];
  return subjects
    .filter(s => s.id !== subjectId && group.subjectIds.includes(s.id))
    .map(s => s.name);
};
