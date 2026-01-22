const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://llnkxxbplosswrskrbkc.supabase.co',
  'sb_publishable_l2n5W3ILhOKtnAdbovVBMw_tWok2ayk'
);

async function checkData() {
  console.log('=== DETAILED DATABASE CHECK ===\n');

  // Check ALL pending_posts regardless of status
  console.log('1. ALL pending_posts (any status):');
  const { data: allPending, error: allPendingErr } = await supabase
    .from('pending_posts')
    .select('*');

  console.log(`Total pending_posts: ${allPending?.length || 0}`);
  if (allPending && allPending.length > 0) {
    const statusCounts = allPending.reduce((acc, post) => {
      acc[post.status] = (acc[post.status] || 0) + 1;
      return acc;
    }, {});
    console.log('Status breakdown:', statusCounts);
    console.log('Sample posts:', JSON.stringify(allPending.slice(0, 3), null, 2));
  } else {
    console.log('No pending_posts found');
  }
  console.log('Error:', allPendingErr);

  // Check posts table
  console.log('\n2. Posts table:');
  const { data: posts, error: postsErr } = await supabase
    .from('posts')
    .select('*');

  console.log(`Total posts: ${posts?.length || 0}`);
  if (posts && posts.length > 0) {
    console.log('Sample posts:', JSON.stringify(posts.slice(0, 3), null, 2));
  }
  console.log('Error:', postsErr);

  // Check notifications
  console.log('\n3. Notifications table:');
  const { data: notifs, error: notifsErr } = await supabase
    .from('notifications')
    .select('*');

  console.log(`Total notifications: ${notifs?.length || 0}`);
  if (notifs && notifs.length > 0) {
    console.log('Sample notifications:', JSON.stringify(notifs.slice(0, 3), null, 2));
  }
  console.log('Error:', notifsErr);

  // Test a specific user ID to see their data
  const testUserId = '022e6524-bc46-42a4-a173-00fc8a7f40ad'; // From the posts data
  console.log(`\n4. Checking data for user ${testUserId}:`);

  const { data: userPending, error: userPendingErr } = await supabase
    .from('pending_posts')
    .select('*')
    .eq('user_id', testUserId);

  console.log(`User's pending_posts: ${userPending?.length || 0}`);
  if (userPending && userPending.length > 0) {
    console.log('User pending posts:', JSON.stringify(userPending, null, 2));
  }

  const { data: userPosts, error: userPostsErr } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', testUserId);

  console.log(`User's posts: ${userPosts?.length || 0}`);
  if (userPosts && userPosts.length > 0) {
    console.log('User posts:', JSON.stringify(userPosts, null, 2));
  }

  const { data: userNotifs, error: userNotifsErr } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', testUserId);

  console.log(`User's notifications: ${userNotifs?.length || 0}`);
  if (userNotifs && userNotifs.length > 0) {
    console.log('User notifications:', JSON.stringify(userNotifs, null, 2));
  }
}

checkData().catch(console.error);