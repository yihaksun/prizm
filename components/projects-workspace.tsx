'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import {
  Box, Briefcase, Check, ChevronDown, ClipboardCheck, Database, Factory, FileCode2, Filter,
  Layers3, Plus, Search, ShieldCheck, User, UserPlus, Users, X,
} from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CodeAssetsTopbar, PortalNavigation } from '@/components/code-assets-workspace';
import { PortalWorkspaceTabs } from '@/components/portal-workspace-tabs';

const projects = [
  { id: 'PRJ000212', title: '용접 품질 고도화', plant: '울산공장', process: '차체 · 용접 2라인', owner: '제조AI기술개발팀', status: '운영', stage: '모니터링', data: 3, code: 5, models: 12, members: 18, updated: '오늘 09:24', tone: 'live' },
  { id: 'PRJ000274', title: 'Surface Zero Defect', plant: '아산공장', process: '도장 · 검사 1라인', owner: '품질AI팀', status: '실험', stage: '모델 평가', data: 4, code: 7, models: 8, members: 14, updated: '오늘 08:40', tone: 'experiment' },
  { id: 'PRJ000318', title: '조지아 용접 품질 고도화', plant: 'HMGMA', process: '차체 · 용접', owner: '글로벌제조AI팀', status: '준비', stage: '데이터 구성', data: 2, code: 3, models: 2, members: 11, updated: '어제', tone: 'ready' },
  { id: 'PRJ000341', title: 'Cell Quality Intelligence', plant: '울산공장', process: '배터리 · 검사 3라인', owner: '전동화품질팀', status: '운영', stage: '모니터링', data: 5, code: 6, models: 6, members: 16, updated: '2일 전', tone: 'live' },
  { id: 'PRJ000356', title: 'Press Quality Guard', plant: '울산공장', process: '프레스 · 성형 1라인', owner: '생산기술AI팀', status: '실험', stage: '모델 학습', data: 3, code: 4, models: 5, members: 12, updated: '3일 전', tone: 'experiment' },
  { id: 'PRJ000401', title: 'Smart Intralogistics', plant: 'HMMA', process: '물류 · AGV', owner: '생산물류혁신팀', status: '기획', stage: '온보딩', data: 1, code: 2, models: 0, members: 8, updated: '5일 전', tone: 'plan' },
];

type Project = (typeof projects)[number];
type RoleKey = 'ml' | 'factory' | 'pm' | 'executive';
type ProjectMember = { id: string; name: string; organization: string };

const roleDefinitions: { id: RoleKey; label: string; description: string; icon: typeof User }[] = [
  { id: 'ml', label: 'ML 엔지니어', description: '데이터·코드·학습·평가 수행', icon: User },
  { id: 'factory', label: '공장 엔지니어', description: '현장 데이터 검토와 공정 판단', icon: Factory },
  { id: 'pm', label: 'PM', description: '과제 진행·승인·구성원 관리', icon: ClipboardCheck },
  { id: 'executive', label: '담당 임원', description: '성과와 주요 승인 현황 열람', icon: Briefcase },
];

const initialAccess: Record<RoleKey, ProjectMember[]> = {
  ml: [
    { id: 'hs-lee', name: '이학선 책임매니저', organization: '제조AI기술개발팀' },
    { id: 'yj-jung', name: '정유진 책임연구원', organization: '제조AI기술개발팀' },
  ],
  factory: [
    { id: 'mh-kim', name: '김민호 매니저', organization: '울산 차체품질팀' },
    { id: 'sj-park', name: '박성진 책임매니저', organization: '울산 차체2부' },
  ],
  pm: [{ id: 'jw-choi', name: '최지원 책임매니저', organization: '제조AI기술개발팀' }],
  executive: [{ id: 'dh-kang', name: '강동현 상무', organization: '제조솔루션본부' }],
};

const memberCandidates: Record<RoleKey, ProjectMember[]> = {
  ml: [
    { id: 'jy-kim', name: '김지영 매니저', organization: '제조AI기술개발팀' },
    { id: 'sw-lee', name: '이승우 책임연구원', organization: '비전AI기술팀' },
  ],
  factory: [
    { id: 'ys-han', name: '한윤석 매니저', organization: '울산 차체품질팀' },
    { id: 'hj-yoon', name: '윤현진 매니저', organization: '울산 생산관리팀' },
  ],
  pm: [
    { id: 'sy-park', name: '박서연 책임매니저', organization: '제조AI기술개발팀' },
    { id: 'tk-kim', name: '김태경 책임매니저', organization: '품질AI팀' },
  ],
  executive: [
    { id: 'js-lee', name: '이지성 상무', organization: '제조솔루션본부' },
    { id: 'kh-park', name: '박건호 전무', organization: '글로벌생산본부' },
  ],
};

function copyMembers(members: Record<RoleKey, ProjectMember[]>) {
  return Object.fromEntries(Object.entries(members).map(([role, list]) => [role, [...list]])) as Record<RoleKey, ProjectMember[]>;
}

export function ProjectsWorkspace() {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('전체 과제');
  const [permissionProject, setPermissionProject] = useState<Project | null>(null);
  const [projectAccess, setProjectAccess] = useState<Record<string, Record<RoleKey, ProjectMember[]>>>({ PRJ000212: copyMembers(initialAccess) });
  const [draftAccess, setDraftAccess] = useState<Record<RoleKey, ProjectMember[]>>(copyMembers(initialAccess));
  const [addingRole, setAddingRole] = useState<RoleKey | null>(null);
  const [candidateId, setCandidateId] = useState('');
  const [notice, setNotice] = useState('');
  const filtered = useMemo(() => projects.filter((project) => {
    const matchesQuery = [project.id, project.title, project.plant, project.process, project.owner].join(' ').toLowerCase().includes(query.toLowerCase());
    const matchesScope = scope === '전체 과제' || (scope === '내 과제' && ['제조AI기술개발팀', '품질AI팀'].includes(project.owner)) || project.status === scope;
    return matchesQuery && matchesScope;
  }), [query, scope]);

  const openPermissions = (project: Project) => {
    setPermissionProject(project);
    setDraftAccess(copyMembers(projectAccess[project.id] ?? initialAccess));
    setAddingRole(null);
    setCandidateId('');
  };

  const removeMember = (role: RoleKey, memberId: string) => {
    setDraftAccess((current) => ({ ...current, [role]: current[role].filter((member) => member.id !== memberId) }));
  };

  const addMember = (role: RoleKey) => {
    const member = memberCandidates[role].find((item) => item.id === candidateId);
    if (!member) return;
    setDraftAccess((current) => ({ ...current, [role]: current[role].some((item) => item.id === member.id) ? current[role] : [...current[role], member] }));
    setAddingRole(null);
    setCandidateId('');
  };

  const savePermissions = () => {
    if (!permissionProject) return;
    setProjectAccess((current) => ({ ...current, [permissionProject.id]: copyMembers(draftAccess) }));
    setNotice(`${permissionProject.title} 과제의 권한 구성을 저장했습니다.`);
    setPermissionProject(null);
  };

  return <SidebarProvider style={{ '--sidebar-width': '248px' } as CSSProperties}>
    <PortalNavigation screen="catalog" activeNavigation={{ group: '과제관리', child: '' }} />
    <div className="app-shell code-assets-shell">
      <CodeAssetsTopbar />
      <PortalWorkspaceTabs current="projects" />
      <main className="projects-page">
        <header className="projects-heading"><div><span>PROJECT MANAGEMENT</span><h1>과제 목록</h1><p>제조 AI 과제의 진행 단계와 연결된 데이터·코드·모델을 한곳에서 확인합니다.</p></div><button type="button"><Plus size={16} /> 신규 과제</button></header>
        <section className="projects-summary"><article><span>전체 과제</span><strong>128</strong><small>8개 글로벌 거점</small></article><article><span>운영</span><strong>64</strong><small>이번 달 +4</small></article><article><span>실험 진행</span><strong>18</strong><small>학습 8 · 평가 10</small></article><article><span>확인이 필요한 과제</span><strong>3</strong><small>성능 이상 1 · 승인 2</small></article></section>
        <section className="projects-toolbar"><label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="과제명, 과제 ID, 공장, 담당 조직 검색" /></label><div>{['전체 과제', '내 과제', '운영', '실험', '준비'].map((item) => <button type="button" className={scope === item ? 'is-active' : ''} onClick={() => setScope(item)} key={item}>{item}</button>)}</div><button type="button" className="projects-filter"><Filter size={14} /> 상세 필터 <ChevronDown size={13} /></button></section>
        <section className="projects-list"><header><span>과제</span><span>거점 / 공정</span><span>현재 단계</span><span>연결 자산</span><span>담당 조직</span><span>최근 변경</span><span>권한</span></header>{filtered.map((project) => <div className="project-row" key={project.id}><span className="project-name-cell"><i className={`project-state ${project.tone}`}><Layers3 size={17} /></i><span><small>{project.id}</small><strong>{project.title}</strong></span></span><span className="project-site-cell"><Factory size={14} /><span><strong>{project.plant}</strong><small>{project.process}</small></span></span><span><b className={`project-status ${project.tone}`}>{project.status}</b><small className="project-stage">{project.stage}</small></span><span className="project-assets-cell"><em><Database size={13} /> {project.data}</em><em><FileCode2 size={13} /> {project.code}</em><em><Box size={13} /> {project.models}</em></span><span className="project-owner-cell"><strong>{project.owner}</strong><small><Users size={11} /> {project.members}명</small></span><span className="project-updated">{project.updated}</span><button type="button" className="project-permission-button" onClick={() => openPermissions(project)}><ShieldCheck size={14} /> 권한 관리</button></div>)}</section>
      </main>
      {notice && <output className="project-permission-notice"><Check size={15} />{notice}<button type="button" aria-label="알림 닫기" onClick={() => setNotice('')}><X size={13} /></button></output>}
      <Dialog open={Boolean(permissionProject)} onOpenChange={(open) => { if (!open) setPermissionProject(null); }}>
        <DialogContent className="project-permission-dialog">
          <DialogHeader className="project-permission-header">
            <span>PROJECT ACCESS CONTROL</span>
            <DialogTitle>과제별 권한 관리</DialogTitle>
            <DialogDescription>{permissionProject?.id} · <b>{permissionProject?.title}</b><small>{permissionProject?.plant} / {permissionProject?.process}</small></DialogDescription>
          </DialogHeader>
          <div className="project-permission-body">
            <div className="project-permission-guide"><ShieldCheck size={18} /><span><strong>과제 역할을 기준으로 데이터, 코드, 실행, 평가 권한이 적용됩니다.</strong><small>구성원 변경 내역은 과제 감사 이력에 자동으로 기록됩니다.</small></span></div>
            <div className="project-role-grid">
              {roleDefinitions.map((role) => {
                const available = memberCandidates[role.id].filter((candidate) => !draftAccess[role.id].some((member) => member.id === candidate.id));
                return <section className="project-role-card" key={role.id}>
                  <header><span className="project-role-icon"><role.icon size={17} /></span><div><h3>{role.label}</h3><p>{role.description}</p></div><b>{draftAccess[role.id].length}명</b></header>
                  <div className="project-member-list">{draftAccess[role.id].map((member) => <div key={member.id}><span className="project-member-avatar">{member.name.slice(0, 1)}</span><span><strong>{member.name}</strong><small>{member.organization}</small></span><button type="button" aria-label={`${member.name} 제거`} onClick={() => removeMember(role.id, member.id)}><X size={13} /></button></div>)}</div>
                  {addingRole === role.id ? <div className="project-member-add"><select value={candidateId} onChange={(event) => setCandidateId(event.target.value)} aria-label={`${role.label} 구성원 선택`}><option value="">구성원 선택</option>{available.map((member) => <option value={member.id} key={member.id}>{member.name} · {member.organization}</option>)}</select><button type="button" disabled={!candidateId} onClick={() => addMember(role.id)}>추가</button><button type="button" aria-label="추가 취소" onClick={() => { setAddingRole(null); setCandidateId(''); }}><X size={13} /></button></div> : <button type="button" className="project-add-member" disabled={!available.length} onClick={() => { setAddingRole(role.id); setCandidateId(''); }}><UserPlus size={14} /> {available.length ? '구성원 추가' : '추가 가능한 구성원 없음'}</button>}
                </section>;
              })}
            </div>
          </div>
          <DialogFooter className="project-permission-footer"><span>총 {Object.values(draftAccess).reduce((sum, members) => sum + members.length, 0)}명의 핵심 구성원</span><button type="button" onClick={() => setPermissionProject(null)}>취소</button><button type="button" className="project-permission-save" onClick={savePermissions}><Check size={14} /> 권한 구성 저장</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </SidebarProvider>;
}
