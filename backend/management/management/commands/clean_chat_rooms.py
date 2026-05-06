from django.core.management.base import BaseCommand
from django.db import transaction
from management.models import ChatRoom, ChatMessage

class Command(BaseCommand):
    help = 'ينظف غرف المحادثة الفردية المكررة ويدمج رسائلها'

    def handle(self, *args, **options):
        self.stdout.write("جاري فحص المحادثات الفردية المكررة...")
        direct_rooms = ChatRoom.objects.filter(room_type='DIRECT').prefetch_related('participants')

        pairs = {}
        for room in direct_rooms:
            p_ids = tuple(sorted(list(room.participants.values_list('id', flat=True))))
            if len(p_ids) == 2:
                if p_ids not in pairs:
                    pairs[p_ids] = []
                pairs[p_ids].append(room)

        cleaned_count = 0
        with transaction.atomic():
            for p_ids, rooms in pairs.items():
                if len(rooms) > 1:
                    rooms.sort(key=lambda r: r.created_at, reverse=True)
                    main_room = rooms[0]
                    duplicate_rooms = rooms[1:]

                    for dup_room in duplicate_rooms:
                        ChatMessage.objects.filter(room=dup_room).update(room=main_room)
                        dup_room.delete()
                        cleaned_count += 1

        self.stdout.write(self.style.SUCCESS(f"تم تنظيف ودمج {cleaned_count} غرفة مكررة بنجاح! ✅"))
