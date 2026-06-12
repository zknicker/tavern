export function readSkillFrontmatterDescription(skillMd: string): string {
    const frontmatter = skillMd.match(/^---\n([\s\S]*?)\n---/u)?.[1];
    const description = frontmatter?.match(/^description:\s*(.+)$/mu)?.[1];
    return description?.trim().replace(/^['"]|['"]$/gu, '') ?? '';
}
