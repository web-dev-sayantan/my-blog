import { Resend } from "resend";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const resend = new Resend(process.env.RESEND_API_KEY);

async function getLatestPost() {
  const postsDir = path.join(process.cwd(), "src/data/blogs");
  const files = fs.readdirSync(postsDir);

  const posts = files
    .filter((file) => file.endsWith(".md") || file.endsWith(".mdx"))
    .map((file) => {
      const filePath = path.join(postsDir, file);
      const content = fs.readFileSync(filePath, "utf8");
      const { data } = matter(content);

      return {
        id: file.replace(/\.(md|mdx)$/, ""),
        data: {
          ...data,
          pubDate: new Date(data.pubDate),
        },
      };
    })
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return posts[0];
}

async function sendNewsletter() {
  try {
    const latestPost = await getLatestPost();

    if (!latestPost) {
      console.log("No posts found");
      return;
    }

    console.log("Latest post:", latestPost.data.title);

    // Get all contacts from audience
    const { data: contacts, error } = await resend.contacts.list({
      audienceId: process.env.RESEND_AUDIENCE_ID,
    });

    if (!contacts.data || contacts.data.length === 0) {
      console.log("No subscribers found");
      return;
    }

    console.log(`Sending to ${contacts.data.length} subscribers`);

    const postUrl = `${process.env.SITE_URL}/blogs/${latestPost.id}`;

    // Send email
    const emailData = await resend.emails.send({
      from: "Sayantan <web.dev.sayantan@gmail.com>", // Replace with your verified domain
      to: contacts.data.map((contact) => contact.email),
      subject: `New Post: ${latestPost.data.title}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h1 style="color: #1f2937;">New Blog Post!</h1>
          
          <h2 style="color: #3b82f6;">
            <a href="${postUrl}" style="color: #3b82f6; text-decoration: none;">
              ${latestPost.data.title}
            </a>
          </h2>
          
          <p style="color: #6b7280; font-size: 16px; line-height: 1.6;">
            ${latestPost.data.description}
          </p>
          
          <div style="margin: 30px 0;">
            <a href="${postUrl}" 
               style="background-color: #3b82f6; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Read the full post →
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 14px;">
            You're receiving this because you subscribed to Sayantan's blog newsletter.
          </p>
        </div>
      `,
    });

    console.log("Newsletter sent successfully:", emailData);
  } catch (error) {
    console.error("Failed to send newsletter:", error);
    process.exit(1);
  }
}

sendNewsletter();
