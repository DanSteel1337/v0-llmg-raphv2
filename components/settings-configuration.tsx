"use client"

import { useState } from "react"
import { Key, Database, Cpu, Check, AlertCircle, Save, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function SettingsConfiguration() {
  const [activeTab, setActiveTab] = useState("api-keys")
  const [isSaving, setIsSaving] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationStatus, setValidationStatus] = useState<"success" | "error" | null>(null)
  const [validationMessage, setValidationMessage] = useState("")

  const handleSaveSettings = () => {
    setIsSaving(true)

    // Simulate API call to save settings
    setTimeout(() => {
      setIsSaving(false)
    }, 1500)
  }

  const handleValidateSettings = () => {
    setIsValidating(true)
    setValidationStatus(null)

    // Simulate API call to validate settings
    setTimeout(() => {
      setIsValidating(false)
      setValidationStatus("success")
      setValidationMessage("All environment variables are valid and properly configured.")
    }, 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings & Configuration</h2>
        <p className="text-muted-foreground">Configure your RAG system settings and integrations.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="vector-db">Vector Database</TabsTrigger>
          <TabsTrigger value="env-vars">Environment Variables</TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>API Key Management</CardTitle>
              <CardDescription>Manage API keys for various services used by the RAG system.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openai-api-key">OpenAI API Key</Label>
                <div className="flex items-center gap-2">
                  <Input id="openai-api-key" type="password" placeholder="sk-..." />
                  <Button variant="outline" size="sm">
                    Validate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Used for embeddings and chat completions.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supabase-api-key">Supabase API Key</Label>
                <div className="flex items-center gap-2">
                  <Input id="supabase-api-key" type="password" placeholder="eyJh..." />
                  <Button variant="outline" size="sm">
                    Validate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Used for authentication and data storage.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pinecone-api-key">Pinecone API Key</Label>
                <div className="flex items-center gap-2">
                  <Input id="pinecone-api-key" type="password" placeholder="12345..." />
                  <Button variant="outline" size="sm">
                    Validate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Used for vector database storage.</p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">Reset</Button>
              <Button onClick={handleSaveSettings} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Usage & Limits</CardTitle>
              <CardDescription>Monitor your API usage and set limits.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>OpenAI Usage</Label>
                  <Badge variant="outline">$12.45 this month</Badge>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-full w-1/4 rounded-full bg-primary"></div>
                </div>
                <p className="text-xs text-muted-foreground">25% of monthly budget used</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Pinecone Usage</Label>
                  <Badge variant="outline">$8.20 this month</Badge>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-full w-2/5 rounded-full bg-primary"></div>
                </div>
                <p className="text-xs text-muted-foreground">40% of monthly budget used</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="monthly-budget">Monthly Budget Limit</Label>
                <div className="flex items-center gap-2">
                  <Input id="monthly-budget" type="number" defaultValue="50" />
                  <span className="text-sm font-medium">USD</span>
                </div>
                <p className="text-xs text-muted-foreground">Set a monthly budget limit for API usage.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Configuration</CardTitle>
              <CardDescription>Configure the AI models used for embeddings and completions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="embedding-model">Embedding Model</Label>
                <Select defaultValue="text-embedding-3-small">
                  <SelectTrigger id="embedding-model">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text-embedding-3-small">text-embedding-3-small</SelectItem>
                    <SelectItem value="text-embedding-3-large">text-embedding-3-large</SelectItem>
                    <SelectItem value="text-embedding-ada-002">text-embedding-ada-002 (Legacy)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Used for converting text to vector embeddings.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="completion-model">Completion Model</Label>
                <Select defaultValue="gpt-4o">
                  <SelectTrigger id="completion-model">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Used for generating responses in the chat interface.</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Model Parameters</Label>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="temperature">
                    <AccordionTrigger>Temperature</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">0.2</span>
                          <Input type="range" min="0" max="1" step="0.1" defaultValue="0.2" className="w-2/3" />
                          <span className="text-sm">1.0</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Controls randomness. Lower values are more deterministic.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="max-tokens">
                    <AccordionTrigger>Max Tokens</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        <Input type="number" defaultValue="1024" min="1" max="4096" />
                        <p className="text-xs text-muted-foreground">
                          Maximum number of tokens to generate in completions.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="top-p">
                    <AccordionTrigger>Top P</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">0.1</span>
                          <Input type="range" min="0.1" max="1" step="0.1" defaultValue="0.9" className="w-2/3" />
                          <span className="text-sm">1.0</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Controls diversity via nucleus sampling.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">Reset to Defaults</Button>
              <Button onClick={handleSaveSettings} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="vector-db" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pinecone Configuration</CardTitle>
              <CardDescription>Configure your Pinecone vector database settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pinecone-environment">Environment</Label>
                <Input id="pinecone-environment" placeholder="e.g., us-west1-gcp" />
                <p className="text-xs text-muted-foreground">The Pinecone environment region.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pinecone-index">Index Name</Label>
                <Input id="pinecone-index" placeholder="e.g., vector-rag-index" />
                <p className="text-xs text-muted-foreground">The name of your Pinecone index.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pinecone-namespace">Namespace</Label>
                <Input id="pinecone-namespace" placeholder="e.g., documents" />
                <p className="text-xs text-muted-foreground">Optional namespace for your vectors.</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Vector Database Settings</Label>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="vector-dimensions">Vector Dimensions</Label>
                      <p className="text-xs text-muted-foreground">Dimension size for embeddings</p>
                    </div>
                    <Input id="vector-dimensions" type="number" defaultValue="1536" className="w-32" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="similarity-metric">Similarity Metric</Label>
                      <p className="text-xs text-muted-foreground">Method to calculate vector similarity</p>
                    </div>
                    <Select defaultValue="cosine">
                      <SelectTrigger id="similarity-metric" className="w-32">
                        <SelectValue placeholder="Select metric" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cosine">Cosine</SelectItem>
                        <SelectItem value="dotproduct">Dot Product</SelectItem>
                        <SelectItem value="euclidean">Euclidean</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="top-k">Top K Results</Label>
                      <p className="text-xs text-muted-foreground">Number of results to return</p>
                    </div>
                    <Input id="top-k" type="number" defaultValue="5" className="w-32" />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">Test Connection</Button>
              <Button onClick={handleSaveSettings} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="env-vars" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Environment Variables</CardTitle>
              <CardDescription>Validate and manage environment variables for your RAG system.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Required Environment Variables</Label>
                <div className="rounded-md border">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">OPENAI_API_KEY</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Valid
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">PINECONE_API_KEY</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Valid
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">PINECONE_ENVIRONMENT</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Valid
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">PINECONE_INDEX</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Valid
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">SUPABASE_URL</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Valid
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">SUPABASE_ANON_KEY</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Valid
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Optional Environment Variables</Label>
                <div className="rounded-md border">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">NEXT_PUBLIC_ENABLE_ANALYTICS</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                    >
                      Not Set
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">NEXT_PUBLIC_MAX_FILE_SIZE</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Valid
                    </Badge>
                  </div>
                </div>
              </div>

              {validationStatus && (
                <Alert
                  variant={validationStatus === "success" ? "default" : "destructive"}
                  className={
                    validationStatus === "success"
                      ? "bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-300"
                      : ""
                  }
                >
                  {validationStatus === "success" ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <AlertTitle>
                    {validationStatus === "success" ? "Validation Successful" : "Validation Failed"}
                  </AlertTitle>
                  <AlertDescription>{validationMessage}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">Reload from .env</Button>
              <Button variant="default" onClick={handleValidateSettings} disabled={isValidating}>
                {isValidating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Validate All
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
