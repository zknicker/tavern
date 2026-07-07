import type { AgentListOutput, PluginListOutput, SkillListOutput } from '../../lib/trpc.tsx';

type Agent = AgentListOutput['agents'][number];
type Plugin = PluginListOutput['plugins'][number];
type SkillSummary = SkillListOutput['skills'][number];

// Plugin-owned skills ride the Plugin grant, so they never appear as per-skill assignments.
export function selectAgentSkills(skills: SkillSummary[], agent: Agent): SkillSummary[] {
    return skills.filter((skill) => !skill.plugin && agent.enabledSkillIds.includes(skill.id));
}

export function selectAddableSkills(skills: SkillSummary[], agent: Agent): SkillSummary[] {
    return skills.filter(
        (skill) =>
            !(skill.plugin || agent.enabledSkillIds.includes(skill.id)) &&
            skill.usability === 'enabled'
    );
}

export function selectGrantedPlugins(plugins: Plugin[], agent: Agent): Plugin[] {
    return plugins.filter((plugin) => agent.enabledPluginIds.includes(plugin.id));
}

// Globally disabled Plugins never show as addable; existing grants still list above it.
export function selectAddablePlugins(plugins: Plugin[], agent: Agent): Plugin[] {
    return plugins.filter(
        (plugin) => plugin.enabled && !agent.enabledPluginIds.includes(plugin.id)
    );
}
