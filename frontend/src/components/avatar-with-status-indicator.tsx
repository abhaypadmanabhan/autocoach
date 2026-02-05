import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function AvatarWithStatusIcon() {
  return (
    <div className="flex gap-2">
      <div className="relative">
        <Avatar>
          <AvatarImage src="https://www.tobybelhome.com/user.png" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
        <div className="border-background absolute -end-0.5 -top-0.5 size-3 rounded-full border-2 bg-green-500">
          <span className="sr-only">Online</span>
        </div>
      </div>

      <div className="relative">
        <Avatar>
          <AvatarImage src="https://github.com/shadcn.png" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
        <div className="border-background absolute -end-0.5 -bottom-0.5 size-3 rounded-full border-2 bg-red-500">
          <span className="sr-only">Offline</span>
        </div>
      </div>

      <div className="relative">
        <Avatar>
          <AvatarImage src="https://images.unsplash.com/photo-1654110455429-cf322b40a906?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fGF2YXRhcnxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&q=60&w=300" />
          <AvatarFallback>TB</AvatarFallback>
        </Avatar>
        <div className="border-background absolute -end-0.5 -top-0.5 size-3 rounded-full border-2 bg-orange-400">
          <span className="sr-only">Offline</span>
        </div>
      </div>
    </div>
  );
}
