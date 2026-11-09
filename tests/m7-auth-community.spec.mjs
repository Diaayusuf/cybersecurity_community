import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const envPath = fileURLToPath(new URL('../supabase/functions/.env.local', import.meta.url));
const localEnv = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) localEnv[match[1]] = match[2];
  }
}
const enabled = process.env.CYBERX_LOCAL_SUPABASE_TESTS === '1'
  && Boolean(localEnv.SUPABASE_URL && localEnv.SUPABASE_ANON_KEY && localEnv.SUPABASE_SERVICE_ROLE_KEY);

test('M7 local Auth, profile, Community persistence, ownership, and sign-out workflow', async ({ page }) => {
  test.skip(!enabled, 'Requires an explicitly enabled isolated local Supabase stack and ignored local test credentials.');
  const email = `m7-${crypto.randomUUID()}@cyberx.local`;
  const password = `CyberX-${crypto.randomUUID()}-Aa!`;
  const secondEmail = `m7-second-${crypto.randomUUID()}@cyberx.local`;
  const secondPassword = `CyberX-${crypto.randomUUID()}-Bb!`;
  let userId = null;
  let secondUserId = null;
  try {
    await page.goto('/auth.html');
    await page.getByLabel('Full name').fill('M7 Integration Member');
    await page.getByLabel('Username').fill(`m7-${crypto.randomUUID().slice(0, 8)}`);
    await page.locator('[data-auth-signup] [name="email"]').fill(email);
    await page.locator('[data-auth-signup] [name="password"]').fill(password);
    await page.locator('[data-auth-signup] [name="confirm-password"]').fill(`${password}mismatch`);
    await page.locator('[data-auth-signup] input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.locator('[data-auth-signup] [data-auth-status]')).toContainText('Passwords do not match');
    await page.locator('[data-auth-signup] [name="confirm-password"]').fill(password);

    await page.locator('[data-auth-signin] [name="email"]').fill(email);
    await page.locator('[data-password-reset]').click();
    await expect(page.locator('[data-auth-signin] [data-auth-status]')).toContainText('reset link has been sent');

    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/profile\.html$/);
    await expect(page.locator('[data-profile-display-name]')).toHaveText('M7 Integration Member');
    userId = await page.evaluate(async () => (await window.CyberXBackend.client.auth.getUser()).data.user?.id || null);
    expect(userId).toBeTruthy();

    await page.getByLabel('Headline').fill('Local verification');
    await page.getByLabel('Bio').fill('<img src=x onerror=alert(1)> profile text');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.locator('[data-profile-status]')).toContainText('saved to your account');
    await page.reload();
    await expect(page.getByLabel('Headline')).toHaveValue('Local verification');
    await expect(page.getByLabel('Bio')).toHaveValue('<img src=x onerror=alert(1)> profile text');
    await expect(page.locator('[data-profile-content] img')).toHaveCount(0);

    await page.goto('/learning.html');
    await expect(page.locator('[data-learning-message]')).toContainText('0 learning paths saved');
    await page.getByRole('button', { name: 'Start path' }).first().click();
    await expect(page.locator('[data-learning-message]')).toContainText('1 learning path saved to your account');
    await expect(page.locator('[data-track-state]').first()).toHaveText('Started');
    await page.getByRole('button', { name: 'Mark path complete' }).first().click();
    await expect(page.locator('[data-learning-message]')).toContainText('marked complete by you');
    await expect(page.locator('[data-track-state]').first()).toHaveText('Completed');
    const completionRetry = await page.evaluate(async () => {
      const { client } = window.CyberXBackend;
      const first = await client.rpc('cyberx_complete_learning_path', { p_track_id: 'offensive-tradecraft' });
      const second = await client.rpc('cyberx_complete_learning_path', { p_track_id: 'offensive-tradecraft' });
      const invalid = await client.rpc('cyberx_complete_learning_path', { p_track_id: 'not-a-course' });
      return { first: first.data, second: second.data, firstError: first.error?.code || null, secondError: second.error?.code || null, invalidError: invalid.error?.code || null };
    });
    expect(completionRetry.firstError).toBeNull();
    expect(completionRetry.secondError).toBeNull();
    expect(completionRetry.second).toBe(completionRetry.first);
    expect(completionRetry.invalidError).toBe('22023');
    await page.reload();
    await expect(page.locator('[data-track-state]').first()).toHaveText('Completed');
    await expect(page.getByRole('button', { name: 'Path completed' }).first()).toBeDisabled();
    await page.goto('/dashboard.html');
    await expect(page.locator('[data-learning-started-count]')).toHaveText('1');
    await expect(page.locator('[data-learning-completed-count]')).toHaveText('1');
    await expect(page.locator('[data-dashboard-recent]')).toContainText('Offensive tradecraft');
    await expect(page.locator('[data-dashboard-recent]')).toContainText('Member-confirmed complete');

    const roleEscalation = await page.evaluate(async () => {
      const { client } = window.CyberXBackend;
      await client.auth.updateUser({ data: { cyberx_role: 'admin' } });
      const { data, error } = await client.rpc('cyberx_has_moderation_role');
      return { role: data, error: error?.code || null };
    });
    expect(roleEscalation).toEqual({ role: false, error: null });

    const invalidSessionStatus = await page.evaluate(async () => {
      const config = window.CYBERX_SUPABASE_CONFIG;
      const response = await fetch(`${config.url}/rest/v1/member_profiles?select=user_id`, {
        headers: { apikey: config.anonKey, authorization: 'Bearer invalid-session-token' },
      });
      return response.status;
    });
    expect([401, 403]).toContain(invalidSessionStatus);

    await page.goto('/community.html');
    await expect(page.locator('[data-community-feed-status]')).toContainText('loaded');
    const title = `<img src=x onerror=alert(1)> M7 post ${crypto.randomUUID().slice(0, 8)}`;
    await page.locator('[name="post-title"]').fill(title);
    await page.locator('[name="post-category"]').selectOption('DFIR');
    await page.locator('[name="post-content"]').fill('Persisted text <script>alert("x")</script>.');
    await page.locator('[data-community-form] button[type="submit"]').click();
    await expect(page.locator('[data-community-status]')).toContainText('published to the community feed');
    const post = page.locator('[data-community-feed] article').filter({ hasText: title }).first();
    await expect(post.locator('.post-title')).toHaveText(title);
    await expect(post.locator('img,script')).toHaveCount(0);
    await expect(post.locator('.community-post-content')).toHaveText('Persisted text <script>alert("x")</script>.');

    const suggestionTitle = `M8 suggestion ${crypto.randomUUID().slice(0, 8)}`;
    await page.locator('[name="suggestion-title"]').fill(suggestionTitle);
    await page.locator('[name="suggestion-detail"]').fill('Add a defensive analysis scenario to the Learning catalog.');
    await page.getByRole('button', { name: 'Submit suggestion' }).click();
    await expect(page.locator('[data-suggestion-status]')).toContainText('submitted for review');
    await expect(page.locator('[data-suggestion-list]')).toContainText('pending');

    await post.getByRole('button', { name: 'Report' }).click();
    await page.getByLabel('Reason').fill('Potential spam or harmful content');
    await page.getByLabel('Details (optional)').fill('Synthetic local moderation verification.');
    await page.getByRole('button', { name: 'Submit report' }).click();
    await expect(post.locator('.community-report-form')).toContainText('submitted privately');
    const ownerWorkflowIds = await page.evaluate(async ({ suggestionTitle, postId }) => {
      const { client } = window.CyberXBackend;
      const suggestion = await client.from('community_suggestions').select('id').eq('title', suggestionTitle).single();
      const report = await client.from('community_reports').select('id').eq('post_id', postId).single();
      return { suggestionId: suggestion.data?.id || null, reportId: report.data?.id || null, error: suggestion.error?.code || report.error?.code || null };
    }, { suggestionTitle, postId: await post.getAttribute('data-post-id') });
    expect(ownerWorkflowIds).toMatchObject({ error: null });
    expect(ownerWorkflowIds.suggestionId).toBeTruthy();
    expect(ownerWorkflowIds.reportId).toBeTruthy();

    const spoofResult = await page.evaluate(async () => {
      const { client } = window.CyberXBackend;
      const { data: userData } = await client.auth.getUser();
      const { error } = await client.from('community_posts').insert({
        title: 'Spoofed author test', category: 'DFIR', content: 'Must be rejected.',
        idempotency_key: crypto.randomUUID(), author_id: '00000000-0000-4000-8000-000000000001',
      });
      return { rejected: Boolean(error), code: error?.code };
    });
    expect(spoofResult.rejected).toBe(true);

    const concurrentPostResults = await page.evaluate(async () => {
      const client = window.CyberXBackend.client;
      const requests = Array.from({ length: 6 }, (_, index) => client.from('community_posts').insert({
        title: `Concurrent limit test ${index}`,
        category: 'DFIR',
        content: 'Synthetic rate-limit verification.',
        idempotency_key: crypto.randomUUID(),
      }));
      const outcomes = await Promise.all(requests);
      return {
        created: outcomes.filter((result) => !result.error).length,
        rateRejected: outcomes.filter((result) => result.error?.code === 'P0001').length,
        otherErrors: outcomes.filter((result) => result.error && result.error.code !== 'P0001').length,
      };
    });
    expect(concurrentPostResults).toEqual({ created: 4, rateRejected: 2, otherErrors: 0 });

    const isolationResult = await page.evaluate(async ({ targetUserId, postTitle, postId, suggestionId, reportId, secondEmail: otherEmail, secondPassword }) => {
      const config = window.CYBERX_SUPABASE_CONFIG;
      const anonymous = window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession: false } });
      const publicFeed = await anonymous.from('community_feed').select('id').limit(1);
      const anonymousWrite = await anonymous.from('community_posts').insert({
        title: 'Anonymous write test', category: 'DFIR', content: 'Must be rejected.', idempotency_key: crypto.randomUUID(),
      });
      const second = window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession: false } });
      const signedUp = await second.auth.signUp({ email: otherEmail, password: secondPassword, options: { data: { display_name: 'M7 Second Member', handle: 'm7second' } } });
      const profileRead = await second.from('member_profiles').select('user_id').eq('user_id', targetUserId).maybeSingle();
      const profileUpdate = await second.from('member_profiles').update({ bio: 'Impersonation attempt' }).eq('user_id', targetUserId).select('user_id');
      const post = await second.from('community_feed').select('id').eq('title', postTitle).single();
      const postDelete = await second.from('community_posts').delete().eq('id', post.data.id).select('id');
      const foreignProgress = await second.from('learning_progress').select('track_id').eq('user_id', targetUserId);
      const foreignReport = await second.from('community_reports').select('id').eq('id', reportId).maybeSingle();
      const foreignSuggestion = await second.from('community_suggestions').select('id').eq('id', suggestionId).maybeSingle();
      const statusMutation = await second.from('community_suggestions').update({ status: 'accepted' }).eq('id', suggestionId).select('id');
      const unauthorizedReview = await second.rpc('cyberx_review_community_item', { p_item_type: 'report', p_item_id: reportId, p_decision: 'hide_post', p_note: '' });
      const roleCheck = await second.rpc('cyberx_has_moderation_role');
      const currentUser = await window.CyberXBackend.client.auth.getUser();
      return {
        publicFeedReadable: !publicFeed.error,
        anonymousWriteDenied: Boolean(anonymousWrite.error),
        secondUserId: signedUp.data.user?.id || null,
        otherProfileHidden: !profileRead.error && profileRead.data === null,
        otherProfileUpdateEmpty: !profileUpdate.error && profileUpdate.data.length === 0,
        otherPostDeleteEmpty: !postDelete.error && postDelete.data.length === 0,
        otherProgressHidden: !foreignProgress.error && foreignProgress.data.length === 0,
        otherReportHidden: !foreignReport.error && foreignReport.data === null,
        otherSuggestionHidden: !foreignSuggestion.error && foreignSuggestion.data === null,
        suggestionStatusMutationDenied: Boolean(statusMutation.error),
        unauthorizedReviewDenied: unauthorizedReview.error?.code === '42501',
        forgedUserRoleDenied: roleCheck.data === false && !roleCheck.error,
        currentUserPresent: Boolean(currentUser.data.user),
      };
    }, { targetUserId: userId, postTitle: title, postId: await post.getAttribute('data-post-id'), suggestionId: ownerWorkflowIds.suggestionId, reportId: ownerWorkflowIds.reportId, secondEmail, secondPassword });
    secondUserId = isolationResult.secondUserId;
    expect(isolationResult.currentUserPresent).toBe(true);
    expect(isolationResult).toMatchObject({
      publicFeedReadable: true, anonymousWriteDenied: true, otherProfileHidden: true,
      otherProfileUpdateEmpty: true, otherPostDeleteEmpty: true,
      otherProgressHidden: true, otherReportHidden: true, otherSuggestionHidden: true,
      suggestionStatusMutationDenied: true, unauthorizedReviewDenied: true, forgedUserRoleDenied: true,
    });

    const like = post.getByRole('button', { name: /like post/i });
    await expect(post.locator('.vote-value')).toHaveText('0');
    await like.click();
    await expect(post.locator('.vote-value')).toHaveText('1');
    await expect(post.getByRole('button', { name: /remove like/i })).toHaveAttribute('aria-pressed', 'true');
    const duplicateLikeCode = await post.evaluate(async (node) => {
      const { error } = await window.CyberXBackend.client.from('community_reactions').insert({ post_id: node.dataset.postId });
      return error?.code || null;
    });
    expect(duplicateLikeCode).toBe('23505');
    await post.getByRole('button', { name: /comments \(/i }).click();
    await post.getByLabel('Comment text').fill('Persisted local comment.');
    await post.getByRole('button', { name: 'Post comment' }).click();
    await expect(page.locator('[data-community-feed-status]')).toContainText('Comment saved');
    await page.reload();
    const reloadedPost = page.locator('[data-community-feed] article').filter({ hasText: title }).first();
    await expect(reloadedPost.locator('.vote-value')).toHaveText('1');
    await reloadedPost.getByRole('button', { name: /comments \(1\)/i }).click();
    await expect(reloadedPost.locator('.community-comment')).toContainText('Persisted local comment.');

    await page.goto('/profile.html');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/auth\.html$/);
    await page.goto('/profile.html');
    await expect(page.locator('[data-profile-access-note]')).toBeVisible();

    await page.goto('/auth.html');
    await page.locator('[data-auth-signin] [name="email"]').fill(email);
    await page.locator('[data-auth-signin] [name="password"]').fill(password);
    await page.getByRole('button', { name: 'Access dashboard' }).click();
    await expect(page).toHaveURL(/profile\.html$/);
    await expect(page.locator('[data-profile-display-name]')).toHaveText('M7 Integration Member');

    const roleGrant = await fetch(`${localEnv.SUPABASE_URL}/auth/v1/admin/users/${secondUserId}`, {
      method: 'PUT',
      headers: {
        apikey: localEnv.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${localEnv.SUPABASE_SERVICE_ROLE_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ app_metadata: { cyberx_role: 'moderator' } }),
    });
    expect(roleGrant.status).toBe(200);
    await page.goto('/auth.html');
    await page.locator('[data-auth-signin] [name="email"]').fill(secondEmail);
    await page.locator('[data-auth-signin] [name="password"]').fill(secondPassword);
    await page.getByRole('button', { name: 'Access dashboard' }).click();
    await expect(page).toHaveURL(/profile\.html$/);
    await page.goto('/community.html');
    await expect(page.locator('[data-moderation-panel]')).toBeVisible();
    const suggestionQueueItem = page.locator('.community-review-item').filter({ hasText: suggestionTitle });
    await expect(suggestionQueueItem).toContainText('pending');
    await suggestionQueueItem.getByRole('button', { name: 'Start review' }).click();
    const reportQueueItem = page.locator('.community-review-item').filter({ hasText: 'Potential spam or harmful content' });
    await expect(reportQueueItem).toBeVisible();
    await reportQueueItem.getByRole('button', { name: 'Hide post' }).click();
    await expect(page.locator('[data-moderation-queue]')).toContainText('Restore post');
    const hiddenPostItem = page.locator('.community-review-item').filter({ hasText: title });
    await hiddenPostItem.getByRole('button', { name: 'Restore post' }).click();
    await expect(page.locator('[data-community-feed]')).toContainText(title);
  } finally {
    if (userId) {
      await fetch(`${localEnv.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          apikey: localEnv.SUPABASE_SERVICE_ROLE_KEY,
          authorization: `Bearer ${localEnv.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
    }
    if (secondUserId) {
      await fetch(`${localEnv.SUPABASE_URL}/auth/v1/admin/users/${secondUserId}`, {
        method: 'DELETE',
        headers: {
          apikey: localEnv.SUPABASE_SERVICE_ROLE_KEY,
          authorization: `Bearer ${localEnv.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
    }
  }
});

test('M6 local Edge Function writes one trusted solve and publishes the safe Realtime event', async ({ page }) => {
  test.skip(!enabled, 'Requires the explicitly started local Edge Function and isolated Supabase stack.');
  await page.goto('/auth.html');
  const challengeConfig = JSON.parse(localEnv.CYBERX_CHALLENGE_CONFIG_JSON);
  const challengeId = 'main';
  const answer = challengeConfig[challengeId].answer;
  const result = await page.evaluate(async ({ challengeId, answer, playerName }) => {
    const backend = window.CyberXBackend;
    const config = window.CYBERX_SUPABASE_CONFIG;
    let resolveEvent;
    const eventPromise = new Promise((resolve) => { resolveEvent = resolve; });
    let resolveSubscription;
    const subscriptionPromise = new Promise((resolve) => { resolveSubscription = resolve; });
    const channel = backend.client.channel(`m6-local-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'puzzle_verified_solves' }, (payload) => resolveEvent(payload.new))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') resolveSubscription(true);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') resolveSubscription(false);
      });
    const subscribed = await Promise.race([subscriptionPromise, new Promise((resolve) => setTimeout(() => resolve(false), 8000))]);
    if (!subscribed) { await backend.client.removeChannel(channel); return { subscribed, functionStatus: 0, event: null }; }
    const response = await fetch(`${config.url}/functions/v1/submit-puzzle`, {
      method: 'POST',
      headers: { apikey: config.anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ challenge_id: challengeId, answer, player_name: playerName, domain: 'local.test', idempotency_key: crypto.randomUUID() }),
    });
    const body = await response.json();
    const event = await Promise.race([eventPromise, new Promise((resolve) => setTimeout(() => resolve(null), 15000))]);
    await backend.client.removeChannel(channel);
    return {
      subscribed,
      functionStatus: response.status,
      responseStatus: body.status,
      idsMatch: Boolean(event && event.id === body.solve_id),
      eventFields: event ? Object.keys(event).sort() : [],
    };
  }, { challengeId, answer, playerName: `M6 Local Event ${crypto.randomUUID().slice(0, 8)}` });
  expect(result.subscribed).toBe(true);
  expect(result.functionStatus).toBe(201);
  expect(result.responseStatus).toBe('verified');
  expect(result.idsMatch).toBe(true);
  expect(result.eventFields).toEqual(['challenge_id', 'domain', 'id', 'name', 'verified_at']);
});

test('M7 local password-reset email link completes recovery and accepts the new password', async ({ page }) => {
  test.skip(!enabled, 'Requires the isolated local Auth stack and local Mailpit inbox.');
  const email = `m7-recovery-${crypto.randomUUID()}@cyberx.local`;
  const password = `CyberX-${crypto.randomUUID()}-Aa!`;
  const newPassword = `CyberX-${crypto.randomUUID()}-Bb!`;
  let userId = null;
  try {
    await page.goto('/auth.html');
    await page.getByLabel('Full name').fill('M7 Recovery Member');
    await page.getByLabel('Username').fill(`recovery-${crypto.randomUUID().slice(0, 8)}`);
    await page.locator('[data-auth-signup] [name="email"]').fill(email);
    await page.locator('[data-auth-signup] [name="password"]').fill(password);
    await page.locator('[data-auth-signup] [name="confirm-password"]').fill(password);
    await page.locator('[data-auth-signup] input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/profile\.html$/);
    userId = await page.evaluate(async () => (await window.CyberXBackend.client.auth.getUser()).data.user?.id || null);
    expect(userId).toBeTruthy();

    await page.goto('/auth.html');
    await page.locator('[data-auth-signin] [name="email"]').fill(email);
    await page.locator('[data-password-reset]').click();
    await expect(page.locator('[data-auth-signin] [data-auth-status]')).toContainText('reset link has been sent');

    let recoveryUrl = null;
    for (let attempt = 0; attempt < 20 && !recoveryUrl; attempt++) {
      const inboxResponse = await fetch('http://127.0.0.1:54324/api/v1/messages');
      if (!inboxResponse.ok) throw new Error('Mailpit API unavailable');
      const inbox = await inboxResponse.json();
      const message = inbox.messages.find((entry) => entry.To?.some((recipient) => recipient.Address.toLowerCase() === email.toLowerCase()));
      if (message) {
        const detailResponse = await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`);
        if (!detailResponse.ok) throw new Error('Recovery message unavailable');
        const detail = await detailResponse.json();
        const links = [...`${detail.HTML || ''}\n${detail.Text || ''}`.matchAll(/https?:\/\/[^\s<>"']+/g)].map((match) => match[0].replace(/&amp;/g, '&').replace(/[),.]+$/, ''));
        recoveryUrl = links.find((candidate) => {
          try { return new URL(candidate).pathname.includes('/auth/v1/verify'); } catch { return false; }
        }) || null;
      }
      if (!recoveryUrl) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    expect(recoveryUrl).toBeTruthy();
    await page.goto(recoveryUrl);
    await expect(page.locator('[data-auth-recovery]')).toBeVisible();
    await page.locator('[data-auth-recovery] [name="password"]').fill(newPassword);
    await page.locator('[data-auth-recovery] [name="confirm-password"]').fill(newPassword);
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.locator('[data-auth-recovery] [data-auth-status]')).toContainText('Password updated');

    await page.goto('/profile.html');
    const newPasswordWorks = await page.evaluate(async ({ email: accountEmail, newPassword: accountPassword }) => {
      const config = window.CYBERX_SUPABASE_CONFIG;
      const client = window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession: false } });
      const { data, error } = await client.auth.signInWithPassword({ email: accountEmail, password: accountPassword });
      await client.auth.signOut();
      return Boolean(data.session) && !error;
    }, { email, newPassword });
    expect(newPasswordWorks).toBe(true);
    await expect(page.locator('[data-profile-display-name]')).toHaveText('M7 Recovery Member');
  } finally {
    if (userId) {
      await fetch(`${localEnv.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          apikey: localEnv.SUPABASE_SERVICE_ROLE_KEY,
          authorization: `Bearer ${localEnv.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
    }
  }
});
