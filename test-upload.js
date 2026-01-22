const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://llnkxxbplosswrskrbkc.supabase.co',
  'sb_publishable_l2n5W3ILhOKtnAdbovVBMw_tWok2ayk'
);

async function testUpload() {
  console.log('Testing upload process...');

  // Simulate a user upload
  const testUserId = '022e6524-bc46-42a4-a173-00fc8a7f40ad'; // Existing user from DB
  const testUserEmail = 'codeguy2024@gmail.com';

  const { data, error } = await supabase.from("pending_posts").insert({
    image_url: "https://example.com/test-image.jpg",
    caption: "Test upload from script",
    user_id: testUserId,
    user_email: testUserEmail,
    status: "pending",
  });

  if (error) {
    console.error('Upload failed:', error);
  } else {
    console.log('Upload successful:', data);
  }

  // Check if it was inserted
  const { data: checkData, error: checkError } = await supabase
    .from('pending_posts')
    .select('*')
    .eq('user_id', testUserId)
    .eq('caption', 'Test upload from script');

  console.log('Verification - inserted post:', checkData);
  console.log('Verification error:', checkError);
}

testUpload().catch(console.error);