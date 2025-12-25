import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, CheckCircle2, AlertCircle, Loader2, Settings, Database, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type SetupStep = 'check' | 'database' | 'admin' | 'complete';

const Setup: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<SetupStep>('check');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Database configuration data
  const [dbData, setDbData] = useState({
    host: 'localhost',
    port: '5432',
    database: 'bingo',
    user: 'postgres',
    password: ''
  });
  
  // Admin user data
  const [adminData, setAdminData] = useState({
    nome: '',
    email: '',
    senha: '',
    confirmarSenha: '',
    titulo_sistema: 'Sorteios'
  });

  useEffect(() => {
    checkSetupRequired();
  }, []);

  const checkSetupRequired = async () => {
    try {
      // First check if database is configured
      const dbConfigResponse = await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkDbConfig' })
      });
      
      const dbConfigData = await dbConfigResponse.json();
      
      if (!dbConfigData.configured) {
        // Database not configured, show database configuration step
        setCurrentStep('database');
        return;
      }
      
      // Database is configured, check if admin exists
      const response = await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkFirstAccess' })
      });
      
      const data = await response.json();
      
      if (data.isFirstAccess === false) {
        // System already configured, redirect to auth
        toast({
          title: "Sistema já configurado",
          description: "Redirecionando para login...",
        });
        navigate('/auth');
        return;
      }
      
      // Need admin creation
      setCurrentStep('admin');
    } catch (error) {
      console.error('Error checking setup:', error);
      // If error, assume database needs configuration
      setCurrentStep('database');
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setError('');

    try {
      const response = await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'testDbConnection',
          host: dbData.host,
          port: dbData.port,
          database: dbData.database,
          user: dbData.user,
          password: dbData.password
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Conexão bem-sucedida",
          description: data.message,
        });
      } else {
        setError(data.error || 'Erro ao testar conexão');
      }
    } catch (error: any) {
      setError(error.message || 'Erro ao testar conexão');
    } finally {
      setIsTesting(false);
    }
  };

  const handleDatabaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // First test the connection
      const testResponse = await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'testDbConnection',
          host: dbData.host,
          port: dbData.port,
          database: dbData.database,
          user: dbData.user,
          password: dbData.password
        })
      });

      const testData = await testResponse.json();

      if (!testData.success) {
        setError(testData.error || 'Erro ao conectar ao banco de dados');
        setIsSubmitting(false);
        return;
      }

      // Save the configuration
      const saveResponse = await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveDbConfig',
          host: dbData.host,
          port: dbData.port,
          database: dbData.database,
          user: dbData.user,
          password: dbData.password
        })
      });

      const saveData = await saveResponse.json();

      if (!saveData.success) {
        setError(saveData.error || 'Erro ao salvar configuração');
        setIsSubmitting(false);
        return;
      }

      // Initialize the database
      const initResponse = await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'initializeDatabase'
        })
      });

      const initData = await initResponse.json();

      if (initData.success) {
        toast({
          title: "Banco de dados configurado",
          description: "Agora configure o usuário administrador.",
        });
        setCurrentStep('admin');
      } else {
        setError(initData.error || 'Erro ao inicializar banco de dados');
      }
    } catch (error: any) {
      setError(error.message || 'Erro ao configurar banco de dados');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    // Validate passwords match
    if (adminData.senha !== adminData.confirmarSenha) {
      setError('As senhas não coincidem');
      setIsSubmitting(false);
      return;
    }

    // Validate password length
    if (adminData.senha.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setupAdmin',
          email: adminData.email,
          senha: adminData.senha,
          nome: adminData.nome,
          titulo_sistema: adminData.titulo_sistema
        })
      });

      const data = await response.json();

      if (data.success || data.user) {
        toast({
          title: "Administrador criado",
          description: "Sistema configurado com sucesso!",
        });
        setCurrentStep('complete');
        
        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate('/auth');
        }, 2000);
      } else {
        setError(data.error || 'Erro ao criar administrador');
      }
    } catch (error: any) {
      setError(error.message || 'Erro ao criar administrador');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (currentStep === 'check') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Settings className="w-8 h-8 text-primary animate-spin" />
            </div>
            <CardTitle className="text-2xl">Verificando Sistema</CardTitle>
            <CardDescription>Aguarde enquanto verificamos a configuração...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (currentStep === 'database') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Database className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Configuração do Banco de Dados</CardTitle>
            <CardDescription>
              Configure a conexão com o PostgreSQL
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert className="mb-4">
              <Database className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Importante:</strong> Certifique-se de que o PostgreSQL está instalado e em execução.
                O sistema criará as tabelas automaticamente.
              </AlertDescription>
            </Alert>
            
            <form onSubmit={handleDatabaseSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  value={dbData.host}
                  onChange={(e) => setDbData({ ...dbData, host: e.target.value })}
                  placeholder="localhost"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Endereço do servidor PostgreSQL (ex: localhost, 192.168.1.100)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="port">Porta</Label>
                <Input
                  id="port"
                  value={dbData.port}
                  onChange={(e) => setDbData({ ...dbData, port: e.target.value })}
                  placeholder="5432"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Porta do PostgreSQL (padrão: 5432)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="database">Nome do Banco</Label>
                <Input
                  id="database"
                  value={dbData.database}
                  onChange={(e) => setDbData({ ...dbData, database: e.target.value })}
                  placeholder="bingo"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Nome do banco de dados (será criado se não existir)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user">Usuário</Label>
                <Input
                  id="user"
                  value={dbData.user}
                  onChange={(e) => setDbData({ ...dbData, user: e.target.value })}
                  placeholder="postgres"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={dbData.password}
                  onChange={(e) => setDbData({ ...dbData, password: e.target.value })}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1" 
                  onClick={handleTestConnection}
                  disabled={isTesting || isSubmitting}
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testando...
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      Testar Conexão
                    </>
                  )}
                </Button>

                <Button type="submit" className="flex-1" disabled={isSubmitting || isTesting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Configurando...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Continuar
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Configuração Inicial</CardTitle>
            <CardDescription>
              Crie o primeiro usuário administrador do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo</Label>
                <Input
                  id="nome"
                  value={adminData.nome}
                  onChange={(e) => setAdminData({ ...adminData, nome: e.target.value })}
                  placeholder="João Silva"
                  required
                  minLength={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={adminData.email}
                  onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                  placeholder="admin@exemplo.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="titulo_sistema">Nome do Sistema</Label>
                <Input
                  id="titulo_sistema"
                  value={adminData.titulo_sistema}
                  onChange={(e) => setAdminData({ ...adminData, titulo_sistema: e.target.value })}
                  placeholder="Sorteios"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  value={adminData.senha}
                  onChange={(e) => setAdminData({ ...adminData, senha: e.target.value })}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmarSenha">Confirmar Senha</Label>
                <Input
                  id="confirmarSenha"
                  type="password"
                  value={adminData.confirmarSenha}
                  onChange={(e) => setAdminData({ ...adminData, confirmarSenha: e.target.value })}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              <Alert>
                <User className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Este será o usuário administrador com acesso total ao sistema.
                  Guarde essas credenciais em local seguro.
                </AlertDescription>
              </Alert>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Configurando Sistema...
                  </>
                ) : (
                  <>
                    <User className="mr-2 h-4 w-4" />
                    Criar Administrador e Iniciar
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Configuração Concluída!</CardTitle>
            <CardDescription>
              Sistema configurado com sucesso
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Você será redirecionado para a página de login em alguns segundos...
              </AlertDescription>
            </Alert>
            
            <Button onClick={() => navigate('/auth')} className="w-full">
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

export default Setup;
