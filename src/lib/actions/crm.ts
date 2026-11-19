'use server';

/**
 * CRM server-action surface.
 *
 * The implementation lives in `./crm/*`, split by domain. This module keeps the
 * existing `@/lib/actions/crm` import path stable and is the only action
 * boundary: Next requires the `'use server'` file to declare the async
 * functions itself, so these are thin typed wrappers around the domain
 * implementations rather than bare re-exports.
 */

import * as broadcasts from './crm/broadcasts';
import type {
  FindCRMContactByEmailResult as FindCRMContactByEmailResultType,
  GetCRMContactsParams as GetCRMContactsParamsType,
} from './crm/contacts-read';
import * as contactsRead from './crm/contacts-read';
import type { SaveCRMContactResult as SaveCRMContactResultType } from './crm/contacts-write';
import * as contactsWrite from './crm/contacts-write';
import * as directEmail from './crm/direct-email';
import * as health from './crm/health';
import * as media from './crm/media';
import * as segments from './crm/segments';
import * as stats from './crm/stats';
import * as sync from './crm/sync';
import type { TaskScope as TaskScopeType } from './crm/tasks';
import * as tasks from './crm/tasks';

export type GetCRMContactsParams = GetCRMContactsParamsType;
export type FindCRMContactByEmailResult = FindCRMContactByEmailResultType;
export type SaveCRMContactResult = SaveCRMContactResultType;
export type TaskScope = TaskScopeType;

export async function getCRMStats(
  ...args: Parameters<typeof stats.getCRMStats>
): ReturnType<typeof stats.getCRMStats> {
  return stats.getCRMStats(...args);
}

export async function getCRMContacts(
  ...args: Parameters<typeof contactsRead.getCRMContacts>
): ReturnType<typeof contactsRead.getCRMContacts> {
  return contactsRead.getCRMContacts(...args);
}

export async function findCRMContactByEmail(
  ...args: Parameters<typeof contactsRead.findCRMContactByEmail>
): ReturnType<typeof contactsRead.findCRMContactByEmail> {
  return contactsRead.findCRMContactByEmail(...args);
}

export async function exportCRMContacts(
  ...args: Parameters<typeof contactsRead.exportCRMContacts>
): ReturnType<typeof contactsRead.exportCRMContacts> {
  return contactsRead.exportCRMContacts(...args);
}

export async function getCRMContactDetail(
  ...args: Parameters<typeof contactsRead.getCRMContactDetail>
): ReturnType<typeof contactsRead.getCRMContactDetail> {
  return contactsRead.getCRMContactDetail(...args);
}

export async function getCRMExistingTags(
  ...args: Parameters<typeof contactsRead.getCRMExistingTags>
): ReturnType<typeof contactsRead.getCRMExistingTags> {
  return contactsRead.getCRMExistingTags(...args);
}

export async function saveCRMContact(
  ...args: Parameters<typeof contactsWrite.saveCRMContact>
): ReturnType<typeof contactsWrite.saveCRMContact> {
  return contactsWrite.saveCRMContact(...args);
}

export async function deleteCRMContact(
  ...args: Parameters<typeof contactsWrite.deleteCRMContact>
): ReturnType<typeof contactsWrite.deleteCRMContact> {
  return contactsWrite.deleteCRMContact(...args);
}

export async function bulkUpdateCRMContacts(
  ...args: Parameters<typeof contactsWrite.bulkUpdateCRMContacts>
): ReturnType<typeof contactsWrite.bulkUpdateCRMContacts> {
  return contactsWrite.bulkUpdateCRMContacts(...args);
}

export async function previewBulkCRMContactUpdate(
  ...args: Parameters<typeof contactsWrite.previewBulkCRMContactUpdate>
): ReturnType<typeof contactsWrite.previewBulkCRMContactUpdate> {
  return contactsWrite.previewBulkCRMContactUpdate(...args);
}

export async function bulkDeleteCRMContacts(
  ...args: Parameters<typeof contactsWrite.bulkDeleteCRMContacts>
): ReturnType<typeof contactsWrite.bulkDeleteCRMContacts> {
  return contactsWrite.bulkDeleteCRMContacts(...args);
}

export async function addCRMNote(
  ...args: Parameters<typeof contactsWrite.addCRMNote>
): ReturnType<typeof contactsWrite.addCRMNote> {
  return contactsWrite.addCRMNote(...args);
}

export async function updateCRMNote(
  ...args: Parameters<typeof contactsWrite.updateCRMNote>
): ReturnType<typeof contactsWrite.updateCRMNote> {
  return contactsWrite.updateCRMNote(...args);
}

export async function deleteCRMNote(
  ...args: Parameters<typeof contactsWrite.deleteCRMNote>
): ReturnType<typeof contactsWrite.deleteCRMNote> {
  return contactsWrite.deleteCRMNote(...args);
}

export async function setCRMEmailConsent(
  ...args: Parameters<typeof contactsWrite.setCRMEmailConsent>
): ReturnType<typeof contactsWrite.setCRMEmailConsent> {
  return contactsWrite.setCRMEmailConsent(...args);
}

export async function importCRMContacts(
  ...args: Parameters<typeof contactsWrite.importCRMContacts>
): ReturnType<typeof contactsWrite.importCRMContacts> {
  return contactsWrite.importCRMContacts(...args);
}

export async function mergeCRMContacts(
  ...args: Parameters<typeof contactsWrite.mergeCRMContacts>
): ReturnType<typeof contactsWrite.mergeCRMContacts> {
  return contactsWrite.mergeCRMContacts(...args);
}

export async function getCRMTasks(
  ...args: Parameters<typeof tasks.getCRMTasks>
): ReturnType<typeof tasks.getCRMTasks> {
  return tasks.getCRMTasks(...args);
}

export async function getCRMTasksForContact(
  ...args: Parameters<typeof tasks.getCRMTasksForContact>
): ReturnType<typeof tasks.getCRMTasksForContact> {
  return tasks.getCRMTasksForContact(...args);
}

export async function addCRMTask(
  ...args: Parameters<typeof tasks.addCRMTask>
): ReturnType<typeof tasks.addCRMTask> {
  return tasks.addCRMTask(...args);
}

export async function setCRMTaskStatus(
  ...args: Parameters<typeof tasks.setCRMTaskStatus>
): ReturnType<typeof tasks.setCRMTaskStatus> {
  return tasks.setCRMTaskStatus(...args);
}

export async function deleteCRMTask(
  ...args: Parameters<typeof tasks.deleteCRMTask>
): ReturnType<typeof tasks.deleteCRMTask> {
  return tasks.deleteCRMTask(...args);
}

export async function updateCRMTask(
  ...args: Parameters<typeof tasks.updateCRMTask>
): ReturnType<typeof tasks.updateCRMTask> {
  return tasks.updateCRMTask(...args);
}

export async function getCRMSegments(
  ...args: Parameters<typeof segments.getCRMSegments>
): ReturnType<typeof segments.getCRMSegments> {
  return segments.getCRMSegments(...args);
}

export async function saveCRMSegment(
  ...args: Parameters<typeof segments.saveCRMSegment>
): ReturnType<typeof segments.saveCRMSegment> {
  return segments.saveCRMSegment(...args);
}

export async function deleteCRMSegment(
  ...args: Parameters<typeof segments.deleteCRMSegment>
): ReturnType<typeof segments.deleteCRMSegment> {
  return segments.deleteCRMSegment(...args);
}

export async function previewCRMBroadcast(
  ...args: Parameters<typeof broadcasts.previewCRMBroadcast>
): ReturnType<typeof broadcasts.previewCRMBroadcast> {
  return broadcasts.previewCRMBroadcast(...args);
}

export async function saveCRMBroadcastDraft(
  ...args: Parameters<typeof broadcasts.saveCRMBroadcastDraft>
): ReturnType<typeof broadcasts.saveCRMBroadcastDraft> {
  return broadcasts.saveCRMBroadcastDraft(...args);
}

export async function deleteCRMBroadcastDraft(
  ...args: Parameters<typeof broadcasts.deleteCRMBroadcastDraft>
): ReturnType<typeof broadcasts.deleteCRMBroadcastDraft> {
  return broadcasts.deleteCRMBroadcastDraft(...args);
}

export async function sendCRMBroadcast(
  ...args: Parameters<typeof broadcasts.sendCRMBroadcast>
): ReturnType<typeof broadcasts.sendCRMBroadcast> {
  return broadcasts.sendCRMBroadcast(...args);
}

export async function sendCRMBroadcastSelfTest(
  ...args: Parameters<typeof broadcasts.sendCRMBroadcastSelfTest>
): ReturnType<typeof broadcasts.sendCRMBroadcastSelfTest> {
  return broadcasts.sendCRMBroadcastSelfTest(...args);
}

export async function markCRMBroadcastFailed(
  ...args: Parameters<typeof broadcasts.markCRMBroadcastFailed>
): ReturnType<typeof broadcasts.markCRMBroadcastFailed> {
  return broadcasts.markCRMBroadcastFailed(...args);
}

export async function getBroadcastProgress(
  ...args: Parameters<typeof broadcasts.getBroadcastProgress>
): ReturnType<typeof broadcasts.getBroadcastProgress> {
  return broadcasts.getBroadcastProgress(...args);
}

export async function getBroadcastEmailEvents(
  ...args: Parameters<typeof broadcasts.getBroadcastEmailEvents>
): ReturnType<typeof broadcasts.getBroadcastEmailEvents> {
  return broadcasts.getBroadcastEmailEvents(...args);
}

export async function getBroadcastFollowUps(
  ...args: Parameters<typeof broadcasts.getBroadcastFollowUps>
): ReturnType<typeof broadcasts.getBroadcastFollowUps> {
  return broadcasts.getBroadcastFollowUps(...args);
}

export async function getCRMBroadcastHistoryPage(
  ...args: Parameters<typeof broadcasts.getCRMBroadcastHistoryPage>
): ReturnType<typeof broadcasts.getCRMBroadcastHistoryPage> {
  return broadcasts.getCRMBroadcastHistoryPage(...args);
}

export async function getCRMBroadcastDrafts(
  ...args: Parameters<typeof broadcasts.getCRMBroadcastDrafts>
): ReturnType<typeof broadcasts.getCRMBroadcastDrafts> {
  return broadcasts.getCRMBroadcastDrafts(...args);
}

export async function getBroadcastRecipientCount(
  ...args: Parameters<typeof broadcasts.getBroadcastRecipientCount>
): ReturnType<typeof broadcasts.getBroadcastRecipientCount> {
  return broadcasts.getBroadcastRecipientCount(...args);
}

export async function sendCRMDirectEmail(
  ...args: Parameters<typeof directEmail.sendCRMDirectEmail>
): ReturnType<typeof directEmail.sendCRMDirectEmail> {
  return directEmail.sendCRMDirectEmail(...args);
}

export async function triggerHistoricalCRMSync(
  ...args: Parameters<typeof sync.triggerHistoricalCRMSync>
): ReturnType<typeof sync.triggerHistoricalCRMSync> {
  return sync.triggerHistoricalCRMSync(...args);
}

export async function getCRMMediaFiles(
  ...args: Parameters<typeof media.getCRMMediaFiles>
): ReturnType<typeof media.getCRMMediaFiles> {
  return media.getCRMMediaFiles(...args);
}

export async function uploadCRMMedia(
  ...args: Parameters<typeof media.uploadCRMMedia>
): ReturnType<typeof media.uploadCRMMedia> {
  return media.uploadCRMMedia(...args);
}

export async function deleteCRMMedia(
  ...args: Parameters<typeof media.deleteCRMMedia>
): ReturnType<typeof media.deleteCRMMedia> {
  return media.deleteCRMMedia(...args);
}

export async function getCRMEdgeFunctionHealth(
  ...args: Parameters<typeof health.getCRMEdgeFunctionHealth>
): ReturnType<typeof health.getCRMEdgeFunctionHealth> {
  return health.getCRMEdgeFunctionHealth(...args);
}
