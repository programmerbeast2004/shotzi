const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://llnkxxbplosswrskrbkc.supabase.co', 'sb_publishable_l2n5W3ILhOKtnAdbovVBMw_tWok2ayk');

async function testFollowerCounts() {
  console.log('Testing follower counts...\n');

  // Test user ID from the follows table
  const testUserId = '022e6524-bc46-42a4-a173-00fc8a7f40ad'; // This user has followers

  console.log(`Testing follower count for user: ${testUserId}`);

  // Count followers
  const { count: followersCount, error: followersError } = await supabase
    .from("follows")
    .select("*", { count: "exact" })
    .eq("following_id", testUserId);

  console.log(`Followers count: ${followersCount}`);
  console.log(`Followers error:`, followersError);

  // Count following
  const { count: followingCount, error: followingError } = await supabase
    .from("follows")
    .select("*", { count: "exact" })
    .eq("follower_id", testUserId);

  console.log(`Following count: ${followingCount}`);
  console.log(`Following error:`, followingError);

  // Get actual follower data
  console.log('\nActual followers:');
  const { data: followers, error: followersDataError } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("following_id", testUserId);

  console.log('Followers data:', followers);
  console.log('Followers data error:', followersDataError);

  // Get profiles for followers
  if (followers && followers.length > 0) {
    const followerIds = followers.map(f => f.follower_id);
    console.log('\nFollower IDs:', followerIds);

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", followerIds);

    console.log('Follower profiles:', profiles);
    console.log('Profiles error:', profilesError);
  }
}

testFollowerCounts().catch(console.error);