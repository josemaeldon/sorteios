import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { User, CreateUserData, UserRole } from '@/types/auth';
import { Sorteio } from '@/types/bingo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Pencil, Trash2, Users, Loader2, ShieldCheck, User as UserIcon, UserPlus, UserMinus, Ticket } from 'lucide-react';
import { z } from 'zod';

interface SorteioAdmin extends Sorteio {
  owner_nome: string;
  owner_email: string;
}

const userSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().email('Email inválido').max(255),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(100).optional().or(z.literal('')),
  role: z.enum(['admin', 'user']),
  titulo_sistema: z.string().min(1, 'Título do sistema é obrigatório').max(100),
});

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { user, getAllUsers, createUser, updateUser, deleteUser, isAuthenticated, getAllSorteiosAdmin, getSorteioUsers, assignSorteioToUser, removeUserFromSorteio } = useAuth();
  
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Sorteio assignment state
  const [sorteios, setSorteios] = useState<SorteioAdmin[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedSorteio, setSelectedSorteio] = useState<SorteioAdmin | null>(null);
  const [sorteioUsers, setSorteioUsers] = useState<User[]>([]);
  const [sorteioOwnerId, setSorteioOwnerId] = useState<string>('');
  const [isLoadingAssign, setIsLoadingAssign] = useState(false);
  const [assignUserId, setAssignUserId] = useState<string>('');
  
  const [formData, setFormData] = useState<Partial<CreateUserData>>({
    nome: '',
    email: '',
    senha: '',
    role: 'user',
    titulo_sistema: 'Sorteios',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    
    if (user?.role !== 'admin') {
      navigate('/');
      return;
    }
    
    loadUsers();
    loadSorteios();
  }, [isAuthenticated, user, navigate]);

  const loadUsers = async () => {
    setIsLoading(true);
    const data = await getAllUsers();
    setUsers(data);
    setIsLoading(false);
  };

  const loadSorteios = async () => {
    const data = await getAllSorteiosAdmin();
    setSorteios(data);
  };

  const handleOpenModal = (userToEdit?: User) => {
    if (userToEdit) {
      setEditingUser(userToEdit);
      setFormData({
        nome: userToEdit.nome,
        email: userToEdit.email,
        senha: '',
        role: userToEdit.role,
        titulo_sistema: userToEdit.titulo_sistema || 'Sorteios',
      });
    } else {
      setEditingUser(null);
      setFormData({ nome: '', email: '', senha: '', role: 'user', titulo_sistema: 'Sorteios' });
    }
    setErrors({});
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormData({ nome: '', email: '', senha: '', role: 'user', titulo_sistema: 'Sorteios' });
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const dataToValidate = {
      ...formData,
      senha: editingUser && !formData.senha ? undefined : formData.senha,
    };
    
    try {
      if (editingUser) {
        if (formData.senha) {
          userSchema.parse(dataToValidate);
        } else {
          userSchema.omit({ senha: true }).parse(dataToValidate);
        }
      } else {
        userSchema.parse(dataToValidate);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
        return;
      }
    }
    
    setIsSubmitting(true);
    
    let result;
    if (editingUser) {
      const updateData: Partial<CreateUserData> = {
        nome: formData.nome,
        email: formData.email,
        role: formData.role,
        titulo_sistema: formData.titulo_sistema,
      };
      if (formData.senha) {
        updateData.senha = formData.senha;
      }
      result = await updateUser(editingUser.id, updateData);
    } else {
      result = await createUser(formData as CreateUserData);
    }
    
    setIsSubmitting(false);
    
    if (result.success) {
      handleCloseModal();
      loadUsers();
    } else {
      setErrors({ form: result.error || 'Erro ao salvar usuário' });
    }
  };

  const handleDeleteClick = (userToRemove: User) => {
    setUserToDelete(userToRemove);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    
    setIsSubmitting(true);
    const result = await deleteUser(userToDelete.id);
    setIsSubmitting(false);
    
    if (result.success) {
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      loadUsers();
    }
  };

  const handleOpenAssignModal = async (sorteio: any) => {
    setSelectedSorteio(sorteio);
    setAssignUserId('');
    setIsLoadingAssign(true);
    setIsAssignModalOpen(true);
    const { data, owner_id } = await getSorteioUsers(sorteio.id);
    setSorteioUsers(data);
    setSorteioOwnerId(owner_id);
    setIsLoadingAssign(false);
  };

  const handleAssignUser = async () => {
    if (!selectedSorteio || !assignUserId) return;
    setIsLoadingAssign(true);
    await assignSorteioToUser(selectedSorteio.id, assignUserId);
    const { data, owner_id } = await getSorteioUsers(selectedSorteio.id);
    setSorteioUsers(data);
    setSorteioOwnerId(owner_id);
    setAssignUserId('');
    setIsLoadingAssign(false);
  };

  const handleRemoveUser = async (userId: string) => {
    if (!selectedSorteio) return;
    setIsLoadingAssign(true);
    await removeUserFromSorteio(selectedSorteio.id, userId);
    const { data, owner_id } = await getSorteioUsers(selectedSorteio.id);
    setSorteioUsers(data);
    setSorteioOwnerId(owner_id);
    setIsLoadingAssign(false);
  };

  const assignableUsers = users.filter(u => !sorteioUsers.some(su => su.id === u.id));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header text-primary-foreground py-6 px-6">
        <div className="container mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="bg-primary-foreground/20 p-2 rounded-lg">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Administração de Usuários</h1>
                <p className="text-primary-foreground/80 text-sm">Gerencie os acessos do sistema</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Usuários</CardTitle>
              <CardDescription>{users.length} usuário(s) cadastrado(s)</CardDescription>
            </div>
            <Button onClick={() => handleOpenModal()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </CardHeader>
          <CardContent>
            <div className="table-container">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {u.role === 'admin' ? (
                            <ShieldCheck className="h-4 w-4 text-primary" />
                          ) : (
                            <UserIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                          {u.nome}
                        </div>
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                          {u.role === 'admin' ? 'Administrador' : 'Usuário'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`status-badge ${u.ativo ? 'status-ativo' : 'status-inativo'}`}>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {new Date(u.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenModal(u)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={u.id === user?.id}
                            onClick={() => handleDeleteClick(u)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Sorteio Assignment Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                Atribuição de Sorteios
              </CardTitle>
              <CardDescription>Atribua sorteios existentes a quantos usuários desejar</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {sorteios.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum sorteio cadastrado no sistema.</p>
            ) : (
              <div className="table-container">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome do Sorteio</TableHead>
                      <TableHead>Proprietário</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="w-[120px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorteios.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.nome}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{s.owner_nome}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.status === 'em_andamento' ? 'default' : 'secondary'}>
                            {s.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {s.data_sorteio ? new Date(s.data_sorteio).toLocaleDateString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenAssignModal(s)}
                          >
                            <Users className="h-4 w-4 mr-1" />
                            Atribuir
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Create/Edit User Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
            <DialogDescription>
              {editingUser 
                ? 'Atualize os dados do usuário. Deixe a senha em branco para manter a atual.' 
                : 'Preencha os dados para criar um novo usuário.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.form && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {errors.form}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                disabled={isSubmitting}
              />
              {errors.nome && <p className="text-destructive text-sm">{errors.nome}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={isSubmitting}
              />
              {errors.email && <p className="text-destructive text-sm">{errors.email}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="senha">
                Senha {editingUser && '(deixe em branco para manter)'}
              </Label>
              <Input
                id="senha"
                type="password"
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                disabled={isSubmitting}
                placeholder={editingUser ? '••••••••' : 'Mínimo 6 caracteres'}
              />
              {errors.senha && <p className="text-destructive text-sm">{errors.senha}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Tipo de Usuário</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="titulo_sistema">Título do Sistema</Label>
              <Input
                id="titulo_sistema"
                value={formData.titulo_sistema}
                onChange={(e) => setFormData({ ...formData, titulo_sistema: e.target.value })}
                disabled={isSubmitting}
                placeholder="Ex: Meus Sorteios"
              />
              {errors.titulo_sistema && <p className="text-destructive text-sm">{errors.titulo_sistema}</p>}
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseModal} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingUser ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o usuário "{userToDelete?.nome}"? 
              Esta ação não pode ser desfeita e todos os dados associados serão removidos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sorteio Assignment Modal */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Atribuir Sorteio: {selectedSorteio?.nome}
            </DialogTitle>
            <DialogDescription>
              Gerencie quais usuários têm acesso a este sorteio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add user */}
            <div className="space-y-2">
              <Label>Adicionar usuário</Label>
              <div className="flex gap-2">
                <Select value={assignUserId} onValueChange={setAssignUserId} disabled={isLoadingAssign}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione um usuário..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAssignUser} disabled={!assignUserId || isLoadingAssign} size="icon">
                  {isLoadingAssign ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Current users */}
            <div className="space-y-2">
              <Label>Usuários com acesso</Label>
              {isLoadingAssign ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : sorteioUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum usuário atribuído.</p>
              ) : (
                <div className="border rounded-lg divide-y">
                  {sorteioUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        {u.role === 'admin' ? (
                          <ShieldCheck className="h-4 w-4 text-primary" />
                        ) : (
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{u.nome}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        {u.id === sorteioOwnerId && (
                          <Badge variant="outline" className="text-xs ml-1">Proprietário</Badge>
                        )}
                      </div>
                      {u.id !== sorteioOwnerId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveUser(u.id)}
                          disabled={isLoadingAssign}
                        >
                          <UserMinus className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
