package com.offlinex.notesbackend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Note {
    private String id;
    private String content;
    private long updatedAt;
    /** pending | sent | synced */
    private String status;
}
