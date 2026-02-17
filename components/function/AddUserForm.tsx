"use client"

import type React from "react"

import { useActionState, useRef, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { createUser } from "@/app/actions/admin"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createUserFormSchema } from "@/forms/createUser"
import { Form, FormMessage, FormControl, FormLabel, FormField, FormItem, FormDescription } from "../ui/form"

const initialState = {
    errors: {
        email: [],
        password: [],
        name: [],
    },
    message: ''
}

export function AddUserForm() {

    const form = useForm({
        resolver: zodResolver(createUserFormSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
        }

    })

    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const [state, action, pending] = useActionState(createUser, initialState);

    useEffect(() => {
        if (state && "success" in state && state.success) {
            router.refresh();
        }
    }, [state, router]);

    return (
        <Form  {...form}>


            <form ref={formRef} onSubmit={() => formRef.current?.requestSubmit()} action={action} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                                <Input placeholder="Enter full name" {...field} />
                            </FormControl>
                            <FormMessage> {"errors" in state ? state.errors?.name : undefined} </FormMessage>
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                                <Input placeholder="user@tamu.org" {...field} />
                            </FormControl>
                            <FormMessage> {"errors" in state ? state.errors?.email : undefined} </FormMessage>
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                                <Input  {...field} />
                            </FormControl>
                            <FormMessage> {"errors" in state ? state.errors?.password : undefined} </FormMessage>
                        </FormItem>
                    )}
                />

                <Button type="submit" className="w-full bg-tama hover:bg-tama/80" disabled={pending}>
                    {pending ? "Adding User..." : "Add User"}
                </Button>
            </form>

        </Form>

    )
}
