const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://llnkxxbplosswrskrbkc.supabase.co',
  'sb_publishable_l2n5W3ILhOKtnAdbovVBMw_tWok2ayk'
);

async function testAdminApproval() {
  console.log('Testing admin approval process...');

  // First, try to insert a pending post (this should fail due to RLS)
  const testUserId = '022e6524-bc46-42a4-a173-00fc8a7f40ad';
  const testUserEmail = 'codeguy2024@gmail.com';

  console.log('1. Trying to insert into pending_posts...');
  const { data: pendingData, error: pendingError } = await supabase.from("pending_posts").insert({
    image_url: "https://example.com/test-image.jpg",
    caption: "Test pending post",
    user_id: testUserId,
    user_email: testUserEmail,
    status: "pending",
  });

  console.log('Pending insert result:', pendingData);
  console.log('Pending insert error:', pendingError);

  // Now try to approve it (insert into posts) - this should work for admin
  console.log('\n2. Trying to insert into posts (admin approval)...');
  const { data: postsData, error: postsError } = await supabase.from("posts").insert({
    image_url: "https://example.com/test-image.jpg",
    caption: "Test approved post",
    user_id: testUserId,
    user_email: testUserEmail,
  });

  console.log('Posts insert result:', postsData);
  console.log('Posts insert error:', postsError);

  // Try to update pending_posts status
  console.log('\n3. Trying to update pending_posts status...');
  // First get a post ID if any exist
  const { data: existingPending, error: getError } = await supabase
    .from('pending_posts')
    .select('id')
    .limit(1);

  if (existingPending && existingPending.length > 0) {
    const { data: updateData, error: updateError } = await supabase
      .from('pending_posts')
      .update({ status: 'approved' })
      .eq('id', existingPending[0].id);

    console.log('Update result:', updateData);
    console.log('Update error:', updateError);
  } else {
    console.log('No pending posts to update');
  }
}

testAdminApproval().catch(console.error);