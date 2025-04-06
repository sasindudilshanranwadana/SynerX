export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: {
      name: string;
      statusCategory: {
        colorName: string;
      };
    };
    issuetype: {
      name: string;
    };
    priority: {
      name: string;
    };
    assignee: {
      displayName: string;
      avatarUrls: {
        '48x48': string;
      };
    } | null;
    created: string;
    updated: string;
    labels: string[];
    epic: string;
  };
}

export interface Epic {
  key: string;
  name: string;
  description?: string;
  issues: JiraIssue[];
}

export interface JiraResponse {
  epics: {
    epic: Epic;
    issues: JiraIssue[];
  }[];
}